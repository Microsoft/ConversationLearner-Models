import { MemoryValue } from './Memory'

const SUBSTITUTE_PREFIX = '$'

export interface FilledEntity {
  entityId: string | null
  values: MemoryValue[]
}

export const filledEntityValueAsString = (fe: FilledEntity): string => {
  // Print out list in friendly manner
  let group = ''
  for (let key in fe.values) {
    let index = +key
    let prefix = ''
    if (fe.values.length !== 1 && index === fe.values.length - 1) {
      prefix = ' and '
    } else if (index !== 0) {
      prefix = ', '
    }
    let value = fe.values[key]
    let text = value.displayText ? value.displayText : value.userText
    group += `${prefix}${text}`
  }
  return group
}

// In future will refactor to remove FilledEntityMap, but this method provides abstraction
// or isolation to methods that would normally consume filledEntityMap to reduce coupling
// and make code more flexible
export const getEntityDisplayValueMap = (filledEntityMap: FilledEntityMap): Map<string, string> => {
  return Object.keys(filledEntityMap.map).reduce((m, key) => {
    const entityDisplayValue = filledEntityMap.EntityValueAsString(key)

    // TODO: Required check because poor API from filledEntityMap which can return null
    if (entityDisplayValue) {
      m.set(key, entityDisplayValue)
    }

    return m
  }, new Map<string, string>())
}

// TODO: Refactor to native Map
export class FilledEntityMap {
  public map: { [key: string]: FilledEntity } = {}

  public constructor(init?: Partial<FilledEntityMap>) {
    Object.assign(this, init)
  }

  public EntityValueAsList(entityName: string): string[] {
    if (!this.map[entityName]) {
      return []
    }

    return this.map[entityName].values.filter(v => typeof v.userText === 'string').map(v => v.userText!)
  }

  public EntityValueAsString(entityName: string): string | null {
    if (!this.map[entityName]) {
      return null
    }

    // Print out list in friendly manner
    return filledEntityValueAsString(this.map[entityName])
  }

  public static Split(action: string): string[] {
    return action.split(/[\s,:.?!\[\]]+/)
  }

  public SubstituteEntities(text: string): string {
    let words = FilledEntityMap.Split(text)

    for (let word of words) {
      if (word.startsWith(SUBSTITUTE_PREFIX)) {
        // Key is in form of $entityName
        let entityName = word.substr(1, word.length - 1)

        let entityValue = this.EntityValueAsString(entityName)
        if (entityValue) {
          text = text.replace(word, entityValue)
        }
      }
    }
    return text
  }

  /** Extract contigent phrases (i.e. [,$name]) */
  private SubstituteBrackets(text: string): string {
    let start = text.indexOf('[')
    let end = text.indexOf(']')

    // If no legal contingency found
    if (start < 0 || end < 0 || end < start) {
      return text
    }

    let phrase = text.substring(start + 1, end)

    // If phrase still contains unmatched entities, cut phrase
    if (phrase.indexOf(SUBSTITUTE_PREFIX) > 0) {
      text = text.replace(`[${phrase}]`, '')
    } else {
      // Otherwise just remove brackets
      text = text.replace(`[${phrase}]`, phrase)
    }
    return this.SubstituteBrackets(text)
  }

  public Substitute(text: string): Promise<string> {
    // First replace all entities
    text = this.SubstituteEntities(text)

    // Remove contingent entities
    text = this.SubstituteBrackets(text)

    return Promise.resolve(text)
  }
}
