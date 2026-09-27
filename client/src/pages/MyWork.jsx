import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import {
  Card, Loading, ErrorNote, Empty, Badge, SeverityBadge, useToast
} from '../components/ui.jsx';
import { IconCheck, IconArchive, IconComment, IconAlert, IconArrowRight } from '../components/Icons.jsx';
import { formatDate, relativeTime, titleCase } from '../lib/format.js';
import { useT } from '../i18n/index.jsx';
import { useLabels } from '../i18n/labels.js';

/**
 * Everything outstanding for the signed-in person, read from live state rather
 * than from the notification table: resolving the work clears the queue whether
 * or not the notification was read.
 */
export default function MyWork() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/notifications/my-work');
  const t = useT();
  const labels = useLabels();

  async function verify(file) {
    try {
      await api.post(`/evidence/${file.evidence_row}/files/${file.file_id}/verify`);
      toast.success('Artefact verified');
      reload();
    } catch (err) { toast.error('Verification failed', err.message); }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">
            {t('myWork.title')}
            {data?.total > 0 && <Badge tone="warn">{t('myWork.outstanding', { count: data.total })}</Badge>}
          </h1>
          <p className="page-sub">
{t('myWork.subtitle', { name: user?.name?.split(' ')[0] || '', role: user?.roleLabel || '' })}
          </p>
        </div>
      </div>

      {loading && <Loading label={t('myWork.gathering')} />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {data && data.total === 0 && (
        <Card>
          <Empty icon={IconCheck} title={t('myWork.nothingWaiting')}>{t('myWork.nothingWaitingBody')}</Empty>
        </Card>
      )}

      <div className="stack">
        {data?.groups?.map((group) => (
          <Card key={group.key}
          title={t(`myWorkGroup.${group.key}`) === group.key ? group.label : t(`myWorkGroup.${group.key}`)}
          subtitle={t(`myWorkGroup.${group.key}Help`).endsWith('Help') ? group.help : t(`myWorkGroup.${group.key}Help`)}
            actions={<Badge tone="neutral">{group.documents.length}</Badge>}
            flush>
            <ul className="worklist">
              {group.documents.map((doc) => (
                <li key={doc.id} className="worklist-item">
                  <div className="worklist-main">
                    <Link to={`/documents/${doc.id}`} className="worklist-title">
                      <span className="ref-tag">{doc.reference}</span>{doc.title}
                    </Link>
                    <div className="worklist-meta">
                      {doc.doc_type_label} · {doc.domain_label} · {doc.status_label}
                      {doc.review_date && ` · review ${formatDate(doc.review_date)}`}
                      {doc.owner_name && ` · owner ${doc.owner_name}`}
                    </div>
                  </div>
                  <div className="worklist-actions">
                    {doc.overdue && <Badge tone="danger">Overdue</Badge>}
                    <Link to={`/documents/${doc.id}`} className="btn btn-sm">
                      {t(`myWorkGroup.${group.key}Action`).endsWith('Action') ? group.action : t(`myWorkGroup.${group.key}Action`)}<IconArrowRight width={13} height={13} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}

        {data?.evidence?.length > 0 && (
          <Card title={t('myWork.evidenceTitle')}
            subtitle={t('myWork.evidenceSubtitle')}
            actions={<Badge tone="neutral">{data.evidence.length}</Badge>}
            flush>
            <ul className="worklist">
              {data.evidence.map((file) => (
                <li key={file.file_id} className="worklist-item">
                  <div className="worklist-main">
                    <div className="worklist-title">
                      <span className="ref-tag">{file.evidence_id}</span>{file.name}
                    </div>
                    <div className="worklist-meta">
                      {file.filename} · collected {formatDate(file.collected_at)}
                      {file.period ? ` · ${file.period}` : ''}
                      {file.collected_by ? ` · by ${file.collected_by}` : ''}
                    </div>
                  </div>
                  <div className="worklist-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => verify(file)}>
                      <IconCheck width={13} height={13} />{t('myWork.verify')}
                    </button>
                    <Link to="/evidence" className="btn btn-sm btn-ghost btn-icon" aria-label={t('myWork.openEvidence')}>
                      <IconArchive width={13} height={13} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data?.findings?.length > 0 && (
          <Card title={t('myWork.findingsTitle')}
            subtitle={t('myWork.findingsSubtitle')}
            actions={<Badge tone="neutral">{data.findings.length}</Badge>}
            flush>
            <ul className="worklist">
              {data.findings.map((finding) => (
                <li key={finding.id} className="worklist-item">
                  <div className="worklist-main">
                    <div className="worklist-title">
                      <IconAlert width={13} height={13} />{finding.title}
                    </div>
                    <div className="worklist-meta">
                      {finding.reference} — {finding.document_title} · {labels.findingCategory(finding.category)} · {relativeTime(finding.created_at)}
                    </div>
                  </div>
                  <div className="worklist-actions">
                    <SeverityBadge severity={finding.severity} />
                    <Link to={`/documents/${finding.document_id}`} className="btn btn-sm">
                      Open<IconArrowRight width={13} height={13} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data?.comments?.length > 0 && (
          <Card title={t('myWork.commentsTitle')}
            subtitle={t('myWork.commentsSubtitle')}
            actions={<Badge tone="neutral">{data.comments.length}</Badge>}
            flush>
            <ul className="worklist">
              {data.comments.map((comment) => (
                <li key={comment.id} className="worklist-item">
                  <div className="worklist-main">
                    <div className="worklist-title">
                      <IconComment width={13} height={13} />{comment.author_name}
                    </div>
                    <div className="worklist-meta">
                      {comment.reference} — {comment.document_title} · {relativeTime(comment.created_at)}
                    </div>
                    <p className="worklist-body">{comment.body}</p>
                  </div>
                  <div className="worklist-actions">
                    <Link to={`/documents/${comment.document_id}`} className="btn btn-sm">
                      Open<IconArrowRight width={13} height={13} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
