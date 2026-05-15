export type ReceiptRecord = {
  place: string;
  total: number;
  paymentMethod: string;
  category: string;
};

export type ParseResponse = {
  record: ReceiptRecord;
  duplicate: boolean;
  existing_date?: string;
};
