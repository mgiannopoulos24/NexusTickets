// Mailbox message (Req 10 inbox/sent), mirroring backend dto.MessageResponse.
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
}
