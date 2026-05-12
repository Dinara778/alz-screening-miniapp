const STORAGE_KEY = 'alz_consultation_requests_v1';

export type ConsultationQueueEntry = {
  consultationEmail: string;
  sessionId: string;
  timestamp: string;
  eventType: string;
  participant?: {
    name?: string;
    email?: string;
    phone?: string;
    sex?: string;
    age?: number;
    education?: string;
    pcConfidence?: number;
  };
};

/** Резервная запись заявки на устройстве (если вебхук недоступен или вернул ошибку). */
export function enqueueConsultationRequest(entry: ConsultationQueueEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: ConsultationQueueEntry[] = raw ? (JSON.parse(raw) as ConsultationQueueEntry[]) : [];
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    // quota / private mode
  }
}
