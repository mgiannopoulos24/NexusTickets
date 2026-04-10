package postgres

import (
	"encoding/json"

	"nexustickets/internal/domain"
)

func userModelToDomain(m UserModel) domain.User {
	return domain.User{
		ID:            m.ID,
		Username:      m.Username,
		PasswordHash:  m.Password,
		FirstName:     m.FirstName,
		LastName:      m.LastName,
		Email:         m.Email,
		Phone:         m.Phone,
		Address:       m.Address,
		City:          m.City,
		Country:       m.Country,
		Latitude:      m.Latitude,
		Longitude:     m.Longitude,
		VATNumber:     m.VATNumber,
		Role:          domain.UserRole(m.Role),
		AccountStatus: domain.AccountStatus(m.AccountStatus),
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}

func userDomainToModel(u domain.User) UserModel {
	return UserModel{
		ID:            u.ID,
		Username:      u.Username,
		Password:      u.PasswordHash,
		FirstName:     u.FirstName,
		LastName:      u.LastName,
		Email:         u.Email,
		Phone:         u.Phone,
		Address:       u.Address,
		City:          u.City,
		Country:       u.Country,
		Latitude:      u.Latitude,
		Longitude:     u.Longitude,
		VATNumber:     u.VATNumber,
		Role:          string(u.Role),
		AccountStatus: string(u.AccountStatus),
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
	}
}

func eventDetailFromModel(b []byte) domain.EventDetail {
	if len(b) == 0 {
		return domain.EventDetail{}
	}
	var d domain.EventDetail
	if err := json.Unmarshal(b, &d); err != nil {
		return domain.EventDetail{}
	}
	return d
}

func eventDetailToModel(d domain.EventDetail) []byte {
	b, err := json.Marshal(d)
	if err != nil || len(b) == 0 {
		return []byte("{}")
	}
	return b
}

func eventModelToDomain(m EventModel) domain.Event {
	return domain.Event{
		ID:               m.ID,
		OrganizerID:      m.OrganizerID,
		Organizer:        nil,
		Title:            m.Title,
		Description:      m.Description,
		Venue:            m.Venue,
		FeaturedImageURL: m.FeaturedImageURL,
		Detail:           eventDetailFromModel(m.EventDetail),
		Address:          m.Address,
		City:             m.City,
		Country:          m.Country,
		Latitude:         m.Latitude,
		Longitude:        m.Longitude,
		StartAt:          m.StartAt,
		EndAt:            m.EndAt,
		Capacity:         m.Capacity,
		Status:           domain.EventStatus(m.Status),
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
		TicketTypes:      nil,
		Bookings:         nil,
	}
}

func eventDomainToModel(e domain.Event) EventModel {
	return EventModel{
		ID:               e.ID,
		OrganizerID:      e.OrganizerID,
		Title:            e.Title,
		Description:      e.Description,
		Venue:            e.Venue,
		FeaturedImageURL: e.FeaturedImageURL,
		EventDetail:      eventDetailToModel(e.Detail),
		Address:          e.Address,
		City:             e.City,
		Country:          e.Country,
		Latitude:         e.Latitude,
		Longitude:        e.Longitude,
		StartAt:          e.StartAt,
		EndAt:            e.EndAt,
		Capacity:         e.Capacity,
		Status:           string(e.Status),
		SearchVector:     "",
		CreatedAt:        e.CreatedAt,
		UpdatedAt:        e.UpdatedAt,
	}
}

func ticketTypeModelToDomain(m TicketTypeModel) domain.TicketType {
	return domain.TicketType{
		ID:        m.ID,
		EventID:   m.EventID,
		Event:     nil,
		Name:      m.Name,
		Price:     m.Price,
		Quantity:  m.Quantity,
		Available: m.Available,
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}

func ticketTypeDomainToModel(t domain.TicketType) TicketTypeModel {
	return TicketTypeModel{
		ID:        t.ID,
		EventID:   t.EventID,
		Name:      t.Name,
		Price:     t.Price,
		Quantity:  t.Quantity,
		Available: t.Available,
		CreatedAt: t.CreatedAt,
		UpdatedAt: t.UpdatedAt,
	}
}

func bookingModelToDomain(m BookingModel) domain.Booking {
	return domain.Booking{
		ID:           m.ID,
		UserID:       m.UserID,
		User:         nil,
		EventID:      m.EventID,
		Event:        nil,
		TicketTypeID: m.TicketTypeID,
		TicketType:   nil,
		Quantity:     m.Quantity,
		TotalCost:    m.TotalCost,
		Status:       domain.BookingStatus(m.Status),
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
}

func bookingDomainToModel(b domain.Booking) BookingModel {
	return BookingModel{
		ID:           b.ID,
		UserID:       b.UserID,
		EventID:      b.EventID,
		TicketTypeID: b.TicketTypeID,
		Quantity:     b.Quantity,
		TotalCost:    b.TotalCost,
		Status:       string(b.Status),
		CreatedAt:    b.CreatedAt,
		UpdatedAt:    b.UpdatedAt,
	}
}

func messageModelToDomain(m MessageModel) domain.Message {
	return domain.Message{
		ID:                 m.ID,
		SenderID:           m.SenderID,
		RecipientID:        m.RecipientID,
		Subject:            m.Subject,
		Body:               m.Body,
		ReadAt:             m.ReadAt,
		DeletedBySender:    m.DeletedBySender,
		DeletedByRecipient: m.DeletedByRecipient,
		CreatedAt:          m.CreatedAt,
	}
}

func messageDomainToModel(msg domain.Message) MessageModel {
	return MessageModel{
		ID:                 msg.ID,
		SenderID:           msg.SenderID,
		RecipientID:        msg.RecipientID,
		Subject:            msg.Subject,
		Body:               msg.Body,
		ReadAt:             msg.ReadAt,
		DeletedBySender:    msg.DeletedBySender,
		DeletedByRecipient: msg.DeletedByRecipient,
		CreatedAt:          msg.CreatedAt,
	}
}

func categoryModelToDomain(m CategoryModel) domain.Category {
	return domain.Category{
		ID:        m.ID,
		Name:      m.Name,
		CreatedAt: m.CreatedAt,
	}
}

func categoryDomainToModel(c domain.Category) CategoryModel {
	return CategoryModel{
		ID:        c.ID,
		Name:      c.Name,
		CreatedAt: c.CreatedAt,
	}
}

func eventPhotoModelToDomain(m EventPhotoModel) domain.EventPhoto {
	return domain.EventPhoto{
		ID:          m.ID,
		EventID:     m.EventID,
		Event:       nil,
		StoragePath: m.StoragePath,
		Position:    m.Position,
		CreatedAt:   m.CreatedAt,
	}
}

func eventPhotoDomainToModel(p domain.EventPhoto) EventPhotoModel {
	return EventPhotoModel{
		ID:          p.ID,
		EventID:     p.EventID,
		StoragePath: p.StoragePath,
		Position:    p.Position,
		CreatedAt:   p.CreatedAt,
	}
}

func chatRoomModelToDomain(m ChatRoomModel) domain.ChatRoom {
	return domain.ChatRoom{
		ID:          m.ID,
		IsGroup:     m.IsGroup,
		Name:        m.Name,
		CreatedByID: m.CreatedByID,
		EventID:     m.EventID,
		IsReadOnly:  m.IsReadOnly,
		CreatedAt:   m.CreatedAt,
	}
}

func chatRoomDomainToModel(r domain.ChatRoom) ChatRoomModel {
	return ChatRoomModel{
		ID:          r.ID,
		IsGroup:     r.IsGroup,
		Name:        r.Name,
		CreatedByID: r.CreatedByID,
		EventID:     r.EventID,
		IsReadOnly:  r.IsReadOnly,
		CreatedAt:   r.CreatedAt,
	}
}

func chatRoomParticipantModelToDomain(m ChatRoomParticipantModel) domain.ChatRoomParticipant {
	u := userModelToDomain(m.User)
	return domain.ChatRoomParticipant{
		ID:         m.ID,
		RoomID:     m.RoomID,
		UserID:     m.UserID,
		User:       &u,
		JoinedAt:   m.JoinedAt,
		LastReadAt: m.LastReadAt,
	}
}

func chatMessageModelToDomain(m ChatMessageModel) domain.ChatMessage {
	u := userModelToDomain(m.Sender)
	return domain.ChatMessage{
		ID:        m.ID,
		RoomID:    m.RoomID,
		SenderID:  m.SenderID,
		Sender:    &u,
		Content:   m.Content,
		ImageURL:  m.ImageURL,
		FileURL:   m.FileURL,
		FileName:  m.FileName,
		GifURL:    m.GifURL,
		ReplyToID: m.ReplyToID,
		CreatedAt: m.CreatedAt,
	}
}

func chatMessageDomainToModel(m domain.ChatMessage) ChatMessageModel {
	return ChatMessageModel{
		ID:        m.ID,
		RoomID:    m.RoomID,
		SenderID:  m.SenderID,
		Content:   m.Content,
		ImageURL:  m.ImageURL,
		FileURL:   m.FileURL,
		FileName:  m.FileName,
		GifURL:    m.GifURL,
		ReplyToID: m.ReplyToID,
		CreatedAt: m.CreatedAt,
	}
}

func messageReactionModelToDomain(m MessageReactionModel) domain.MessageReaction {
	u := userModelToDomain(m.User)
	return domain.MessageReaction{
		ID:           m.ID,
		MessageID:    m.MessageID,
		UserID:       m.UserID,
		User:         &u,
		ReactionType: m.ReactionType,
		CreatedAt:    m.CreatedAt,
	}
}

func messageReactionDomainToModel(r domain.MessageReaction) MessageReactionModel {
	return MessageReactionModel{
		ID:           r.ID,
		MessageID:    r.MessageID,
		UserID:       r.UserID,
		ReactionType: r.ReactionType,
		CreatedAt:    r.CreatedAt,
	}
}
