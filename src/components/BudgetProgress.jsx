import './BudgetProgress.css'

const stages = {
  starting: ['Assessing your month…', 0],
  checking: ['Checking your spending…', 0],
  reviewing: ['Reviewing income and upcoming bills…', 1],
  refining: ['Refining your spending limits…', 1],
  preparing: ['Preparing your limits…', 2],
}

export default function BudgetProgress({ stage }) {
  const [label, current] = stages[stage] || stages.reviewing
  return <div className="budget-progress" role="status">
    <div><p>{label}</p><span>You can leave this tab while it finishes.</span></div>
    <div className="budget-progress-rail" aria-hidden="true">{[0, 1, 2].map((step) => <i key={step} className={step < current ? 'is-done' : step === current ? 'is-current' : ''} />)}</div>
  </div>
}
