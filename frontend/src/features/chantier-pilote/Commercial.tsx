import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Building2, Loader2, Plus, Wallet, X } from 'lucide-react';
import { apiGet, apiPost, type Page } from '@/shared/lib/api';
import { fetchAllPages } from '@/shared/lib/apiHelpers';
import { costControlApi } from '@/features/cost-control/api';
import { projectsApi, type Project } from '@/features/projects/api';
import type { Contact } from '@/features/contacts/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { localDay } from './api';
import { usePilotCopy } from './copy';

interface Purchase {
  id: string; po_number: string; vendor_name: string | null; amount_total: string;
  currency_code: string; delivery_date: string | null; status: string;
}
const money = (amount: string | undefined | null, currency: string) => amount == null ? '—' : new Intl.NumberFormat('fr-MA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount));

export function Commercial({ mode, project, search, onSaved }: { mode: 'costs' | 'purchases'; project?: Project; search: string; onSaved: () => void }) {
  const { t } = usePilotCopy();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  useEffect(() => { setDialog(false); }, [mode, project?.id]);
  const report = useQuery({ queryKey: ['cp', userId, 'costs', project?.id], enabled: !!project && mode === 'costs', queryFn: () => costControlApi.report(project!.id, 'cost_line') });
  const orders = useQuery({
    queryKey: ['cp', userId, 'orders', project?.id], enabled: !!project && mode === 'purchases',
    queryFn: async () => {
      const result = await fetchAllPages<Purchase>((offset, limit) => apiGet<Page<Purchase>>(`/v1/procurement/?project_id=${project!.id}&offset=${offset}&limit=${limit}`));
      if (result.truncated) throw new Error('Purchase register exceeded the safe read limit');
      return result.items;
    },
  });
  if (!project) return <section className="cp-panel cp-empty"><span><Building2 size={30} /></span><h3>{t('chooseProject')}</h3><p>{t('selectCommercial')}</p></section>;
  const query = mode === 'costs' ? report : orders;
  if (query.isPending) return <div className="cp-loading"><Loader2 className="cp-spin" />{t('loading')}</div>;
  if (query.isError) return <div role="alert" className="cp-error">{t('error')}<button onClick={() => void query.refetch()}>{t('retry')}</button></div>;
  const currency = project.currency;
  const totals = report.data?.totals;
  return <>
    <section className="cp-commercial-banner"><div><Wallet size={25} /><div><span className="cp-eyebrow">{t('project')}</span><h2>{project.name}</h2><p>{t('commercialHint')}</p></div></div><button className="cp-button cp-dark" onClick={() => setDialog(true)} disabled={!navigator.onLine}><Plus size={17} />{t(mode === 'costs' ? 'editBudget' : 'newPurchase')}</button></section>
    {mode === 'costs' ? <>
      <section className="cp-metrics cp-money-metrics">{[['budget', project.budget_estimate], ['committed', totals?.committed], ['invoiced', totals?.invoiced], ['forecast', totals?.forecast]].map(([label, value]) => <div className="cp-metric" key={label}><span>{t(label!)}</span><strong>{money(value, currency)}</strong></div>)}</section>
      <section className="cp-panel"><div className="cp-section-heading"><h2>{t('costLines')}</h2><Link to={`/cost-control?project_id=${project.id}`}>{t('costDetails')}<ArrowUpRight size={16} /></Link></div>
        <div className="cp-table-scroll"><table className="cp-table"><thead><tr>{['description', 'costBudget', 'committed', 'invoiced', 'forecast'].map((k) => <th key={k}>{t(k)}</th>)}</tr></thead><tbody>{report.data?.rows.filter((r) => `${r.code} ${r.description}`.toLocaleLowerCase('fr').includes(search)).map((row) => <tr key={row.key}><td><small>{row.code}</small>{row.description}</td><td>{money(row.budget, currency)}</td><td>{money(row.committed, currency)}</td><td>{money(row.invoiced, currency)}</td><td>{money(row.forecast, currency)}</td></tr>)}</tbody></table></div>
        {!report.data?.rows.length && <p className="cp-empty">{t('costEmpty')}</p>}
        <Link className="cp-text-button" to={`/projects/${project.id}/boq`}>{t('estimates')}<ArrowUpRight size={16} /></Link>
      </section>
    </> : <section className="cp-panel"><div className="cp-section-heading"><h2>{t('purchases')}</h2><Link to={`/projects/${project.id}/procurement`}>{t('workflow')}<ArrowUpRight size={16} /></Link></div>
      <div className="cp-table-scroll"><table className="cp-table"><thead><tr>{['orderNumber', 'vendor', 'amount', 'delivery', 'status'].map((k) => <th key={k}>{t(k)}</th>)}</tr></thead><tbody>{orders.data?.filter((order) => `${order.po_number} ${order.vendor_name ?? ''}`.toLocaleLowerCase('fr').includes(search)).map((order) => <tr key={order.id}><td><Link to={`/projects/${project.id}/procurement?po=${order.id}`}>{order.po_number}</Link></td><td>{order.vendor_name || t('vendorNone')}</td><td>{money(order.amount_total, order.currency_code)}</td><td>{order.delivery_date || '—'}</td><td><span className="cp-pill">{t(order.status, { defaultValue: order.status })}</span></td></tr>)}</tbody></table></div>
      {!orders.data?.length && <div className="cp-empty"><h3>{t('purchaseEmpty')}</h3><button className="cp-button cp-primary" onClick={() => setDialog(true)}><Plus size={16} />{t('newPurchase')}</button></div>}
    </section>}
    {dialog && <CommercialDialog mode={mode} project={project} onClose={() => setDialog(false)} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ['cp', userId] }); onSaved(); }} />}
  </>;
}

function CommercialDialog({ mode, project, onClose, onSaved }: { mode: 'costs' | 'purchases'; project: Project; onClose: () => void; onSaved: () => void }) {
  const { t } = usePilotCopy();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [queued, setQueued] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const contacts = useQuery({
    queryKey: ['cp', userId, 'suppliers'], enabled: mode === 'purchases',
    queryFn: async () => {
      const result = await fetchAllPages<Contact>((offset, limit) => apiGet<Page<Contact>>(`/v1/contacts/?contact_type=supplier&offset=${offset}&limit=${limit}`));
      if (result.truncated) throw new Error('Supplier register exceeded the safe read limit');
      return result.items;
    },
  });
  useEffect(() => { ref.current?.showModal(); }, []);
  const save = useMutation({
    mutationFn: (data: FormData) => {
      if (!navigator.onLine) throw new Error('Offline');
      if (mode === 'costs') return projectsApi.update(project.id, { budget_estimate: String(data.get('amount')) });
      return apiPost<{ id: string }>('/v1/procurement/', {
        project_id: project.id, issue_date: localDay(), status: 'draft', currency_code: project.currency,
        ...(data.get('vendor') ? { vendor_contact_id: String(data.get('vendor')) } : {}),
        ...(data.get('delivery') ? { delivery_date: String(data.get('delivery')) } : {}),
        tax_rate_pct: String(data.get('vat')), notes: String(data.get('notes') || ''),
        items: [{ description: String(data.get('description')).trim(), quantity: String(data.get('quantity')), unit_rate: String(data.get('rate')), unit: 'u' }],
      });
    },
    onSuccess: (result) => { if (!result?.id) { setQueued(true); return; } onSaved(); onClose(); },
    onError: () => setError(t('saveError')),
  });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); save.mutate(new FormData(event.currentTarget)); }
  return <dialog ref={ref} className="cp-dialog cp-app" aria-labelledby="cp-commercial-title" onCancel={(e) => save.isPending ? e.preventDefault() : onClose()}><header><div><span className="cp-eyebrow">BANYRA / {project.currency}</span><h2 id="cp-commercial-title">{t(mode === 'costs' ? 'editBudget' : 'newPurchase')}</h2></div><button className="cp-icon-button" onClick={onClose} disabled={save.isPending} aria-label={t('close')}><X /></button></header>
    <form onSubmit={submit}>{mode === 'costs' ? <label className="cp-field">{t('budgetAmount')}<input name="amount" type="number" min="0" step="0.01" required defaultValue={project.budget_estimate || ''} /></label> : <>
      <label className="cp-field">{t('vendor')}<select name="vendor"><option value="">{t('vendorNone')}</option>{contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.company_name || c.contact_name || `${c.first_name || ''} ${c.last_name || ''}`}</option>)}</select></label>
      {contacts.isError && <p role="alert" className="cp-error">{t('error')}</p>}
      <label className="cp-field">{t('description')}<input name="description" required maxLength={500} /></label>
      <div className="cp-form-grid"><label className="cp-field">{t('quantity')}<input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></label><label className="cp-field">{t('rate')}<input name="rate" type="number" min="0" step="0.01" required /></label></div>
      <div className="cp-form-grid"><label className="cp-field">{t('vat')}<input name="vat" type="number" min="0" max="100" step="0.01" defaultValue={project.default_vat_rate || '0'} required /></label><label className="cp-field">{t('delivery')}<input name="delivery" type="date" /></label></div>
      <label className="cp-field">{t('description')}<textarea name="notes" rows={3} maxLength={5000} /></label><p className="cp-form-hint">{t('purchaseDraft')}</p>
    </>}{error && <p role="alert" className="cp-error">{error}</p>}{queued && <p role="status">{t('queued')}</p>}<footer><button className="cp-button cp-secondary" type="button" disabled={save.isPending} onClick={onClose}>{t('cancel')}</button><button className="cp-button cp-primary" disabled={save.isPending || queued}>{save.isPending && <Loader2 className="cp-spin" size={17} />}{t(save.isPending ? 'saving' : 'save')}</button></footer></form>
  </dialog>;
}
