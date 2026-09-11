package main

import (
	"embed"
	"errors"
	"fmt"
	"hash/fnv"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nexustickets/internal/repository/postgres"
)

// A small pool of free stock photos (Lorem Picsum, 1024×576) shipped with the
// seeder, so a fresh install has pictures without anyone uploading anything.
//
//go:embed photos/*.jpg
var seedPhotos embed.FS

const photosPerEvent = 5

// seedEventPhotos gives every event without photos a five-picture gallery and
// a featured image, copying files into the media directory the API serves
// from (`MEDIA_STORAGE_PATH/<event id>/…`) and writing the matching rows.
// Deterministic: the same event always gets the same five pictures.
func seedEventPhotos(d *gorm.DB, mediaRoot string) {
	names, err := fs.Glob(seedPhotos, "photos/*.jpg")
	if err != nil || len(names) == 0 {
		panic(fmt.Errorf("no bundled seed photos: %v", err))
	}
	sort.Strings(names)

	var events []postgres.EventModel
	if err := d.Select("id", "title", "featured_image_url").Find(&events).Error; err != nil {
		panic(fmt.Errorf("list events for photos: %w", err))
	}

	now := time.Now().UTC()
	seeded := 0
	for _, ev := range events {
		var existing int64
		if err := d.Model(&postgres.EventPhotoModel{}).Where("event_id = ?", ev.ID).Count(&existing).Error; err != nil {
			panic(err)
		}
		if existing > 0 {
			continue
		}

		dir := filepath.Join(mediaRoot, ev.ID.String())
		if err := os.MkdirAll(dir, 0o755); err != nil {
			panic(fmt.Errorf("create media dir for %s: %w", ev.Title, err))
		}

		// Start at a position derived from the id so neighbouring events do
		// not share the same five pictures in the same order.
		h := fnv.New32a()
		_, _ = h.Write([]byte(ev.ID.String()))
		offset := int(h.Sum32() % uint32(len(names)))

		var featured *string
		for pos := 0; pos < photosPerEvent; pos++ {
			src := names[(offset+pos)%len(names)]
			data, err := seedPhotos.ReadFile(src)
			if err != nil {
				panic(err)
			}
			fileName := uuid.NewString() + ".jpg"
			if err := os.WriteFile(filepath.Join(dir, fileName), data, 0o644); err != nil {
				panic(fmt.Errorf("write photo for %s: %w", ev.Title, err))
			}
			relative := filepath.ToSlash(filepath.Join(ev.ID.String(), fileName))
			row := postgres.EventPhotoModel{
				ID:          uuid.New(),
				EventID:     ev.ID,
				StoragePath: relative,
				Position:    pos,
				CreatedAt:   now,
			}
			if err := d.Create(&row).Error; err != nil {
				panic(fmt.Errorf("insert photo row for %s: %w", ev.Title, err))
			}
			if pos == 0 {
				url := "/uploads/media/" + relative
				featured = &url
			}
		}

		if featured != nil && (ev.FeaturedImageURL == nil || strings.TrimSpace(*ev.FeaturedImageURL) == "") {
			if err := d.Model(&postgres.EventModel{}).Where("id = ?", ev.ID).
				Update("featured_image_url", *featured).Error; err != nil {
				panic(fmt.Errorf("set featured image for %s: %w", ev.Title, err))
			}
		}
		seeded++
	}

	fmt.Printf("seeded photos for %d events (%d each)\n", seeded, photosPerEvent)
}

// ensureMediaRoot resolves the media directory the way the server does.
func ensureMediaRoot(path string) string {
	if err := os.MkdirAll(path, 0o755); err != nil && !errors.Is(err, os.ErrExist) {
		panic(fmt.Errorf("media root %s: %w", path, err))
	}
	return path
}
