/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import EntityIdSerializer, { IOptions } from './slateSerializer'
import { ScoredBase, ScoredAction } from './Score'

export enum ActionTypes {
  TEXT = 'TEXT',
  API_LOCAL = 'API_LOCAL',
  CARD = 'CARD',
  END_SESSION = 'END_SESSION',
  SET_ENTITY = 'SET_ENTITY',
}

export enum ConditionType {
  EQUAL = "EQUAL"
}

export interface Condition {
  entityId: string
  valueId: string
  condition: ConditionType
}

export interface ActionClientData {
  // Used to match import utterances to actions
  importHashes?: string[]
}

// Need dummy actionId for stub action
export const CL_STUB_IMPORT_ACTION_ID = '51cd7df5-e504-451d-b629-0932e604689c'

export class ActionBase {
  actionId: string
  actionType: ActionTypes
  createdDateTime: string
  payload: string
  isTerminal: boolean
  requiredEntitiesFromPayload: string[]
  requiredEntities: string[] = []
  negativeEntities: string[] = []
  requiredConditions: Condition[] = []
  negativeConditions: Condition[] = []
  suggestedEntity: string | undefined
  version: number
  packageCreationId: number
  packageDeletionId: number
  entityId: string | undefined
  enumValueId: string | undefined
  clientData?: ActionClientData

  constructor(action: ActionBase) {
    this.actionId = action.actionId
    this.actionType = action.actionType
    this.createdDateTime = action.createdDateTime
    this.payload = action.payload
    this.isTerminal = action.isTerminal
    this.requiredEntitiesFromPayload = action.requiredEntitiesFromPayload || []
    this.requiredEntities = action.requiredEntities || []
    this.negativeEntities = action.negativeEntities || []
    this.requiredConditions = action.requiredConditions || []
    this.negativeConditions = action.negativeConditions || []
    this.suggestedEntity = action.suggestedEntity
    this.version = action.version
    this.packageCreationId = action.packageCreationId
    this.packageDeletionId = action.packageDeletionId
    this.entityId = action.entityId
    this.enumValueId = action.enumValueId
    this.clientData = action.clientData
  }

  // TODO: Refactor away from generic GetPayload for different action types
  // They all return strings but the strings are very different (Text is the substituted values, but other actions dont)
  // This causes issue of having to pass in entityValueMap even when it's not required, but making it optional ruins
  // safety for those places which should require it.
  // TODO: Remove ScoredAction since it doesn't have payload
  static GetPayload(action: ActionBase | ScoredBase, entityValues: Map<string, string>): string {
    if (action.actionType === ActionTypes.TEXT) {
      /**
       * For backwards compatibility check if payload is of new TextPayload type
       * Ideally we would implement schema refactor:
       * 1. Make payloads discriminated unions (E.g. After checking the action.type, flow control knows the type of the payload property)
       * This removes the need for the GetPayload function and GetArguments which are brittle coding patterns.
       */
      try {
        const textPayload = JSON.parse(action.payload) as TextPayload
        return EntityIdSerializer.serialize(textPayload.json, entityValues)
      } catch (e) {
        const error = e as Error
        throw new Error(
          `Error when attempting to parse text action payload. This might be an old action which was saved as a string.  Please create a new action. ${
            error.message
          }`
        )
      }
    } else if (action.actionType === ActionTypes.END_SESSION) {
      const textPayload = JSON.parse(action.payload) as TextPayload
      return EntityIdSerializer.serialize(textPayload.json, entityValues)
    }
    // For API or CARD the payload field of the outer payload is the name of API or the filename of the card template without extension
    else if (ActionTypes.CARD === action.actionType) {
      let cardPayload = JSON.parse(action.payload) as CardPayload
      return cardPayload.payload
    } else if (ActionTypes.API_LOCAL === action.actionType) {
      let actionPayload = JSON.parse(action.payload) as ActionPayload
      return actionPayload.payload
    }
    return action.payload
  }

  // Return true if action is a stub action
  static isStubbedAPI(action: Partial<ActionBase> | undefined): boolean {
    if (!action) {
      return false
    }
    if (action.payload && JSON.parse(action.payload).payload === "STUB_API") {
      return true
    }
    return false
  }

  // Create dummy stub action
  static getStubAction(): ActionBase
  {
    return new ActionBase({
      actionId: null!,
      payload: JSON.stringify({payload: "STUB_API", logicArguments: [], renderArguments: []}),
      createdDateTime: new Date().toJSON(),
      isTerminal: false,
      requiredEntitiesFromPayload: [],
      requiredEntities: [],
      negativeEntities: [],
      requiredConditions: [],
      negativeConditions: [],
      suggestedEntity: undefined,
      version: 0,
      packageCreationId: 0,
      packageDeletionId: 0,
      actionType: ActionTypes.API_LOCAL,
      entityId: undefined,
      enumValueId: undefined
    })
  }

  /** Return arguments for an action */
  static GetActionArguments(action: ActionBase | ScoredAction): ActionArgument[] {
    if (ActionTypes.CARD === action.actionType) {
      let cardPayload = JSON.parse(action.payload) as CardPayload
      return cardPayload.arguments.map(aa => new ActionArgument(aa))
    } else if (action.actionType === ActionTypes.API_LOCAL) {
      let actionPayload = JSON.parse(action.payload) as ActionPayload
      return [...actionPayload.logicArguments, ...actionPayload.renderArguments].map(aa => new ActionArgument(aa))
    }

    return []
  }
}

export interface ActionList {
  actions: ActionBase[]
}

export interface ActionIdList {
  actionIds: string[]
}

// TODO: Remove was originally storing two properties text/json
// but now text is removed and this is only here for backwards compatibility
export interface TextPayload {
  json: object
}

export interface ActionPayloadSingleArguments {
  payload: string
  arguments: IActionArgument[]
}

export interface ActionPayload {
  payload: string
  logicArguments: IActionArgument[]
  renderArguments: IActionArgument[]
}

export interface CardPayload {
  payload: string
  arguments: IActionArgument[]
}

export interface IActionArgument {
  parameter: string
  value: TextPayload
}

export class ActionArgument {
  parameter: string
  value: object

  constructor(actionArgument: IActionArgument) {
    this.parameter = actionArgument.parameter
    this.value = actionArgument.value.json
  }

  renderValue(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): string {
    return EntityIdSerializer.serialize(this.value, entityValues, serializerOptions)
  }
}

export interface RenderedActionArgument {
  parameter: string
  value: string | null
}

export class TextAction extends ActionBase {
  value: object // json slate value

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.TEXT) {
      throw new Error(`You attempted to create text action from action of type: ${action.actionType}`)
    }

    this.value = JSON.parse(this.payload).json
  }

  renderValue(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): string {
    return EntityIdSerializer.serialize(this.value, entityValues, serializerOptions)
  }
}

export class ApiAction extends ActionBase {
  name: string
  logicArguments: ActionArgument[]
  renderArguments: ActionArgument[]

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.API_LOCAL) {
      throw new Error(`You attempted to create api action from action of type: ${action.actionType}`)
    }

    const actionPayload: ActionPayload = JSON.parse(this.payload)
    this.name = actionPayload.payload
    this.logicArguments = actionPayload.logicArguments ? actionPayload.logicArguments.map(aa => new ActionArgument(aa)): []
    this.renderArguments = actionPayload.renderArguments ? actionPayload.renderArguments.map(aa => new ActionArgument(aa)) : []
  }
  renderLogicArguments(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): RenderedActionArgument[] {
    return this.renderArgs(this.logicArguments, entityValues, serializerOptions)
  }

  renderRenderArguments(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): RenderedActionArgument[] {
    return this.renderArgs(this.renderArguments, entityValues, serializerOptions)
  }

  private renderArgs(
    args: ActionArgument[],
    entityValues: Map<string, string>,
    serializerOptions: Partial<IOptions> = {}
  ): RenderedActionArgument[] {
    return args.map(aa => {
      let value = null
      try {
        value = EntityIdSerializer.serialize(aa.value, entityValues, serializerOptions)
      } catch (error) {
        // Just return null if argument doesn't have a value
      }

      return {
        ...aa,
        value: value
      }
    })
  }
}

export class CardAction extends ActionBase {
  templateName: string
  arguments: ActionArgument[]

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.CARD) {
      throw new Error(`You attempted to create card action from action of type: ${action.actionType}`)
    }

    const payload: CardPayload = JSON.parse(this.payload)
    this.templateName = payload.payload
    this.arguments = payload.arguments.map(aa => new ActionArgument(aa))
  }

  renderArguments(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): RenderedActionArgument[] {
    return this.arguments.map(aa => {
      let value = null
      try {
        value = EntityIdSerializer.serialize(aa.value, entityValues, serializerOptions)
      } catch (error) {
        // Just return null if argument doesn't have a value
      }

      return {
        ...aa,
        value: value
      }
    })
  }
}

export class SessionAction extends ActionBase {
  value: object // json slate value

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.END_SESSION) {
      throw new Error(`You attempted to create session action from action of type: ${action.actionType}`)
    }

    this.value = JSON.parse(this.payload).json
  }

  renderValue(entityValues: Map<string, string>, serializerOptions: Partial<IOptions> = {}): string {
    return EntityIdSerializer.serialize(this.value, entityValues, serializerOptions)
  }
}

export type SetEntityPayload = {
  entityId: string
  enumValueId: string
}

export class SetEntityAction extends ActionBase {
  entityId: string
  enumValueId: string

  constructor(action: ActionBase) {
    super(action)

    if (action.actionType !== ActionTypes.SET_ENTITY) {
      throw new Error(`You attempted to create set entity action from action of type: ${action.actionType}`)
    }

    // TODO: Server already has actual entityId and enumValueId values, should not need to use payload like this
    // but some things like scored action only have the payload
    const jsonPayload = JSON.parse(this.payload) as SetEntityPayload
    this.entityId = jsonPayload.entityId
    this.enumValueId = jsonPayload.enumValueId
  }
}
