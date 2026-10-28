import { Link } from 'react-router-dom';
import { usePilotCopy } from './copy';

export function Brand() {
  const { t } = usePilotCopy();
  return <Link className="cp-brand" to="/pilot" aria-label={t('brandAlt')}>
    <span className="cp-mark" aria-hidden="true"><i /><i /><i /></span>
    <span>banyra<span className="cp-brand-dot">.</span><small>{t('tagline')}</small></span>
  </Link>;
}
