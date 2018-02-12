import { Metrics } from './Metrics'
import { FilledEntity } from './FilledEntity'

export interface ScoreInput {
  filledEntities: FilledEntity[]
  context: {}
  maskedActions: string[]
}

export interface ScoredBase {
  actionId: string
  payload: string
  isTerminal: boolean
  actionType: string
}

export interface UnscoredAction extends ScoredBase {
  reason: string
}

export interface ScoredAction extends ScoredBase {
  score: number
}

export interface ScoreResponse {
  scoredActions: ScoredAction[]
  unscoredActions: UnscoredAction[]
  metrics: Metrics
}
