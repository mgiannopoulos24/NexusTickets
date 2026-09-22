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
	repaired := 0
	for _, ev := range events {
		var existing []postgres.EventPhotoModel
		if err := d.Where("event_id = ?", ev.ID).Find(&existing).Error; err != nil {
			panic(err)
		}

		// Rows alone do not prove the pictures are still there. A database that
		// was reset and re-seeded while the media directory pointed somewhere
		// else (a container without the uploads bind mount, say) leaves rows
		// referencing files that never landed on disk — and because the old
		// check only counted rows, every later run skipped the event and the
		// API served 404s forever. So verify the files too, and rebuild the
		// gallery when any of them is missing.
		stale := false
		if len(existing) > 0 {
			if photoFilesPresent(mediaRoot, existing) {
				continue
			}
			if err := d.Where("event_id = ?", ev.ID).
				Delete(&postgres.EventPhotoModel{}).Error; err != nil {
				panic(fmt.Errorf("drop stale photo rows for %s: %w", ev.Title, err))
			}
			stale = true
			repaired++
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

		// On a repair the stored featured image points at a file that is gone,
		// so it has to be replaced rather than preserved.
		if featured != nil && (stale || ev.FeaturedImageURL == nil || strings.TrimSpace(*ev.FeaturedImageURL) == "") {
			if err := d.Model(&postgres.EventModel{}).Where("id = ?", ev.ID).
				Update("featured_image_url", *featured).Error; err != nil {
				panic(fmt.Errorf("set featured image for %s: %w", ev.Title, err))
			}
		}
		seeded++
	}

	if repaired > 0 {
		fmt.Printf("seeded photos for %d events (%d each, %d rebuilt because their files were missing)\n",
			seeded, photosPerEvent, repaired)
		return
	}
	fmt.Printf("seeded photos for %d events (%d each)\n", seeded, photosPerEvent)
}

// photoFilesPresent reports whether every row of a gallery still has its file
// on disk. One missing file makes the whole gallery suspect, so the caller
// rebuilds it wholesale instead of patching individual rows.
func photoFilesPresent(mediaRoot string, rows []postgres.EventPhotoModel) bool {
	for _, r := range rows {
		if _, err := os.Stat(filepath.Join(mediaRoot, filepath.FromSlash(r.StoragePath))); err != nil {
			return false
		}
	}
	return true
}

// ensureMediaRoot resolves the media directory the way the server does.
func ensureMediaRoot(path string) string {
	if err := os.MkdirAll(path, 0o755); err != nil && !errors.Is(err, os.ErrExist) {
		panic(fmt.Errorf("media root %s: %w", path, err))
	}
	return path
}
