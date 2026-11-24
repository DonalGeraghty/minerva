import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import {
  RULE_ACTIONS, RULE_FIELDS, RULE_OPERATORS, RULE_SCOPES, RULE_STATUSES, RULE_TYPES,
  commitRulesImport, createFinanceRule, deleteFinanceRule, downloadText, exportRulesCsv,
  exportRulesJson, listFinanceRules, listRuleHistory, previewRulesImport, restoreRuleVersion,
  updateFinanceRule,
} from '../services/financeRules.js'

const EMPTY_FORM = {
  rule_id: '', scope: 'janus', name: '', type: 'accounting', field: 'event_type',
  operator: 'equals', value: '', action: 'classify', action_value: '', priority: 100,
  status: 'active', source_section: '', description: '',
}

function ruleToForm(rule) {
  return {
    rule_id: rule.rule_id, scope: rule.scope, name: rule.name, type: rule.type, field: rule.field,
    operator: rule.operator, value: rule.value ?? '', action: rule.action, action_value: rule.action_value ?? '',
    priority: rule.priority, status: rule.status === 'deleted' ? 'disabled' : rule.status,
    source_section: rule.source_section ?? '', description: rule.description ?? '',
  }
}

function Select({ label, value, onChange, options, disabled }) {
  return (
    <label>{label}
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

export default function RulesPage() {
  const [rules, setRules] = useState([])
  const [ruleSetVersion, setRuleSetVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [scopeFilter, setScopeFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [csvText, setCsvText] = useState('')
  const [importName, setImportName] = useState('')
  const [preview, setPreview] = useState(null)
  const [history, setHistory] = useState(null)
  const fileInput = useRef(null)
  const abort = useRef(null)

  const load = useCallback(async () => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    setError('')
    setErrorCode('')
    try {
      const data = await listFinanceRules({ includeDeleted: true, signal: controller.signal })
      setRules(data.rules || [])
      setRuleSetVersion(data.rule_set_version || 0)
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message || 'Could not load finance rules')
        setErrorCode(requestError.code || '')
      }
    } finally {
      if (abort.current === controller) setLoading(false)
    }
  }, [])

  useEffect(() => { load(); return () => abort.current?.abort() }, [load])

  const visible = useMemo(() => rules.filter((rule) => {
    if (statusFilter && rule.status !== statusFilter) return false
    if (scopeFilter && rule.scope !== scopeFilter) return false
    if (search) {
      const haystack = `${rule.rule_id} ${rule.name} ${rule.field} ${rule.value} ${rule.action} ${rule.description}`.toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return false
    }
    return true
  }), [rules, search, statusFilter, scopeFilter])

  const startCreate = () => { setEditing('new'); setForm(EMPTY_FORM); setFormError('') }
  const startEdit = (rule) => { setEditing(rule.rule_id); setForm(ruleToForm(rule)); setFormError('') }
  const closeEditor = () => { setEditing(null); setForm(EMPTY_FORM); setFormError('') }

  const saveRule = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    setError('')
    try {
      const payload = { ...form, priority: Number(form.priority) }
      if (editing === 'new') {
        await createFinanceRule(payload)
        setNotice(`Created rule ${payload.rule_id}.`)
      } else {
        const current = rules.find((rule) => rule.rule_id === editing)
        await updateFinanceRule(editing, { ...payload, revision: current?.revision })
        setNotice(`Updated rule ${editing}.`)
      }
      closeEditor()
      await load()
    } catch (requestError) {
      setFormError(requestError.message || 'Could not save the rule')
    } finally {
      setBusy(false)
    }
  }

  const removeRule = async (rule) => {
    if (!window.confirm(`Delete rule ${rule.rule_id}? It stays in the version history.`)) return
    setBusy(true)
    setError('')
    try {
      await deleteFinanceRule(rule.rule_id, rule.revision)
      setNotice(`Deleted rule ${rule.rule_id}.`)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Could not delete the rule')
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (rule) => {
    const status = rule.status === 'active' ? 'disabled' : 'active'
    setBusy(true)
    setError('')
    try {
      await updateFinanceRule(rule.rule_id, { revision: rule.revision, status })
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Could not change the rule status')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error || new Error('Could not read the file'))
        reader.readAsText(file)
      })
      setCsvText(text)
      setImportName(file.name)
      const result = await previewRulesImport(text)
      setPreview(result)
    } catch (requestError) {
      setPreview(null)
      setError(requestError.message || 'Could not preview the CSV')
    } finally {
      setBusy(false)
    }
  }

  const commitImport = async () => {
    if (!csvText) return
    setBusy(true)
    setError('')
    try {
      const result = await commitRulesImport(csvText)
      setNotice(`Imported rules into rule-set version ${result.rule_set_version}.`)
      setPreview(null)
      setCsvText('')
      setImportName('')
      if (fileInput.current) fileInput.current.value = ''
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Could not import the CSV')
    } finally {
      setBusy(false)
    }
  }

  const onExport = async (format) => {
    setBusy(true)
    setError('')
    try {
      if (format === 'csv') downloadText('financial_rules.csv', await exportRulesCsv())
      else downloadText('financial_rules.json', JSON.stringify(await exportRulesJson(), null, 2), 'application/json')
    } catch (requestError) {
      setError(requestError.message || 'Could not export the rules')
    } finally {
      setBusy(false)
    }
  }

  const toggleHistory = async () => {
    if (history) { setHistory(null); return }
    setBusy(true)
    setError('')
    try {
      setHistory(await listRuleHistory())
    } catch (requestError) {
      setError(requestError.message || 'Could not load rule history')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (version) => {
    if (!window.confirm(`Restore rule-set version ${version}? The current set becomes a new history entry.`)) return
    setBusy(true)
    setError('')
    try {
      await restoreRuleVersion(version)
      setNotice(`Restored rule-set version ${version}.`)
      setHistory(null)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Could not restore the version')
    } finally {
      setBusy(false)
    }
  }

  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <main className="page rules-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Finance &middot; rule set v{ruleSetVersion}</p>
        <h1>Rules.</h1>
        <p>Upload a rules CSV or manage rules one by one. Janus stores them per account; the Google Sheet stays the canonical ledger.</p>
      </section>

      <section className="app-panel" aria-label="Rule controls">
        <header>
          <div>
            <p className="settings-kicker">Manage</p>
            <h2>Rule set</h2>
          </div>
          <div className="rules-toolbar">
            <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, name, merchant&hellip;" /></label>
            <label>Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All</option>
                {[...RULE_STATUSES, 'deleted'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>Scope
              <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
                <option value="">All</option>
                {RULE_SCOPES.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
              </select>
            </label>
            <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()} disabled={busy}>Import CSV&hellip;</button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={onFile} aria-label="Import rules CSV file" />
            <button className="secondary-button" type="button" onClick={() => onExport('csv')} disabled={busy}>Export CSV</button>
            <button className="secondary-button" type="button" onClick={() => onExport('json')} disabled={busy}>Export JSON</button>
            <button className="secondary-button" type="button" onClick={toggleHistory} disabled={busy}>{history ? 'Hide history' : 'History'}</button>
            <button className="primary-button" type="button" onClick={startCreate} disabled={busy}>Add rule</button>
          </div>
        </header>
        {error && <p className="settings-message is-error" role="alert">{error}{errorCode === 'finance_not_connected' && <> <Link to="/account">Connect your workbook in Account.</Link></>}</p>}
        {notice && <p className="settings-message is-success" role="status">{notice}</p>}

        {preview && (
          <div className="rules-import-summary" aria-label="CSV import preview">
            <p className="settings-kicker">Preview of {importName}</p>
            <p>{preview.changes.length} row(s): {preview.changes.filter((c) => c.change === 'create').length} to create, {preview.changes.filter((c) => c.change === 'update').length} to update, {preview.changes.filter((c) => c.change === 'unchanged').length} unchanged. {preview.held.length} held for review. {preview.conflicts.length} conflict group(s). New rule-set version would be {preview.would_be_version}.</p>
            {preview.held.length > 0 && <ul>{preview.held.map((item) => <li key={item.rule_id}>{item.rule_id}: {item.reason}</li>)}</ul>}
            {preview.conflicts.length > 0 && <ul>{preview.conflicts.map((conflict) => <li key={conflict.rule_ids.join(',')}>Conflict on {conflict.field} {conflict.operator} {conflict.value}: {conflict.rule_ids.join(', ')}</li>)}</ul>}
            <button className="primary-button" type="button" onClick={commitImport} disabled={busy}>{busy ? 'Importing…' : 'Commit import'}</button>
          </div>
        )}

        {history && (
          <div className="rules-history" aria-label="Rule set history">
            <p className="settings-kicker">Rule-set versions</p>
            {history.history.length === 0 ? <p>No versions yet.</p> : (
              <table>
                <caption>Every change creates one version</caption>
                <thead><tr><th>Version</th><th>When</th><th>Summary</th><th>Changed</th><th></th></tr></thead>
                <tbody>
                  {history.history.map((entry) => (
                    <tr key={entry.version}>
                      <td>v{entry.version}</td>
                      <td>{entry.created_at?.slice(0, 19).replace('T', ' ')}Z</td>
                      <td>{entry.summary}</td>
                      <td>{(entry.changed_rule_ids || []).join(', ')}</td>
                      <td><button className="secondary-button" type="button" onClick={() => restore(entry.version)} disabled={busy}>Restore</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {loading ? <p role="status">Loading rules&hellip;</p> : (
          <table>
            <caption>{visible.length} of {rules.length} rules</caption>
            <thead><tr><th>ID</th><th>Name</th><th>Condition</th><th>Action</th><th>Priority</th><th>Status</th><th>Rev</th><th></th></tr></thead>
            <tbody>
              {visible.map((rule) => (
                <tr key={rule.rule_id} className={rule.status === 'deleted' ? 'is-deleted' : ''}>
                  <td>{rule.rule_id}</td>
                  <td>{rule.name}{rule.review_reason && <><br /><small>{rule.review_reason}</small></>}</td>
                  <td>{rule.field} {rule.operator} {rule.value}</td>
                  <td>{rule.action}{rule.action_value ? `: ${rule.action_value}` : ''}</td>
                  <td>{rule.priority}</td>
                  <td><span className={`rules-badge is-${rule.status}`}>{rule.status}</span></td>
                  <td>{rule.revision}</td>
                  <td className="rules-row-actions">
                    <button className="secondary-button" type="button" onClick={() => startEdit(rule)} disabled={busy || rule.status === 'deleted'}>Edit</button>
                    {rule.status !== 'deleted' && (
                      <button className="secondary-button" type="button" onClick={() => toggleStatus(rule)} disabled={busy}>{rule.status === 'active' ? 'Disable' : 'Enable'}</button>
                    )}
                    <button className="secondary-button" type="button" onClick={() => removeRule(rule)} disabled={busy || rule.status === 'deleted'}>Delete</button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={8}>No rules match. Import a CSV or add a rule.</td></tr>}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <section className="app-panel" aria-label={editing === 'new' ? 'Add rule' : `Edit rule ${editing}`}>
          <header><div><p className="settings-kicker">{editing === 'new' ? 'New rule' : `Editing ${editing}`}</p><h2>{editing === 'new' ? 'Add a rule.' : 'Edit rule.'}</h2></div></header>
          <form onSubmit={saveRule} className="rule-form">
            <label>Rule ID<input value={form.rule_id} onChange={(event) => setField('rule_id')(event.target.value)} required pattern="[A-Za-z0-9_\-]{1,64}" disabled={editing !== 'new'} /></label>
            <Select label="Scope" value={form.scope} onChange={setField('scope')} options={RULE_SCOPES} />
            <label>Name<input value={form.name} onChange={(event) => setField('name')(event.target.value)} required maxLength={120} /></label>
            <Select label="Type" value={form.type} onChange={setField('type')} options={RULE_TYPES} />
            <Select label="Field" value={form.field} onChange={setField('field')} options={RULE_FIELDS} />
            <Select label="Operator" value={form.operator} onChange={setField('operator')} options={RULE_OPERATORS} />
            <label>Value<input value={form.value} onChange={(event) => setField('value')(event.target.value)} maxLength={500} placeholder="empty for 'always'; use | for 'in'" /></label>
            <Select label="Action" value={form.action} onChange={setField('action')} options={RULE_ACTIONS} />
            <label>Action value<input value={form.action_value} onChange={(event) => setField('action_value')(event.target.value)} maxLength={500} /></label>
            <label>Priority<input type="number" min={0} max={100000} value={form.priority} onChange={(event) => setField('priority')(event.target.value)} required /></label>
            <Select label="Status" value={form.status} onChange={setField('status')} options={RULE_STATUSES} />
            <label>Source section<input value={form.source_section} onChange={(event) => setField('source_section')(event.target.value)} maxLength={200} /></label>
            <label>Description<textarea value={form.description} onChange={(event) => setField('description')(event.target.value)} maxLength={2000} rows={2} /></label>
            {formError && <p className="settings-message is-error" role="alert">{formError}</p>}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save rule'}</button>
              <button className="secondary-button" type="button" onClick={closeEditor} disabled={busy}>Cancel</button>
            </div>
          </form>
        </section>
      )}
    </main>
  )
}
