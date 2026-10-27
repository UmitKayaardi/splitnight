import { getSample, type SampleId } from '../samples/samples';
import { billFromReceipt, emptyBill, useBill } from './bill';

export function startSample(id: SampleId) {
  const sample = getSample(id);
  useBill.getState().start(billFromReceipt(sample.receipt, 'sample', id), 'review');
}

export function startManual() {
  useBill.getState().start(emptyBill('manual'), 'review');
}
