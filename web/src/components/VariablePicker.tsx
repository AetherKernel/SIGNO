// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.

import type { Variable } from '../../shared/contracts.ts'

interface Props {
  variables: Variable[]
  value: string
  onChange: (variableId: string) => void
}

export function VariablePicker({ variables, value, onChange }: Props) {
  return (
    <fieldset className="picker">
      <legend>1. Choose what to investigate</legend>
      {variables.map((variable) => (
        <label key={variable.id} className={variable.id === value ? 'option selected' : 'option'}>
          <input
            type="radio"
            name="variable"
            value={variable.id}
            checked={variable.id === value}
            onChange={() => onChange(variable.id)}
          />
          <span className="option-name">{variable.name}</span>
          <span className="option-description">{variable.description}</span>
          <span className="option-source">
            {variable.product.kind === 'satellite' ? 'Satellite observation' : 'Model output'} · NASA{' '}
            {variable.product.shortName} v{variable.product.version} ({variable.product.provider})
          </span>
        </label>
      ))}
    </fieldset>
  )
}
