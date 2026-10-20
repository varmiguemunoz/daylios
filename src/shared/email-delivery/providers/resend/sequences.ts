import { CapabilityNotSupported, ProviderRuleViolation } from '../../domain/errors'
import type {
  RemoteSequence,
  RemoteSequenceDetail,
  SequenceEngine,
  SequenceStep
} from '../../ports/sequences'
import type {
  ResendAutomationDetail,
  ResendAutomationDraft,
  ResendAutomationStep,
  ResendClient
} from './api'

export function buildDraft(
  name: string,
  event: string,
  emails: { wait: string }[],
  templates: string[],
  enabled: boolean
): ResendAutomationDraft {
  const steps: ResendAutomationStep[] = [
    { key: 'start', type: 'trigger', config: { eventName: event } }
  ]
  emails.forEach((email, i) => {
    if (email.wait)
      steps.push({ key: `wait_${i + 1}`, type: 'delay', config: { duration: email.wait } })
    steps.push({
      key: `email_${i + 1}`,
      type: 'send_email',
      config: { template: { id: templates[i] } }
    })
  })
  const connections = steps.slice(1).map((step, i) => ({ from: steps[i].key, to: step.key }))
  return { name, status: enabled ? 'enabled' : 'disabled', steps, connections }
}

export function toRemoteSequence(a: ResendAutomationDetail): RemoteSequence {
  const trigger = a.steps.find((s) => s.type === 'trigger')
  const event = trigger ? (trigger.config.eventName ?? trigger.config.event_name ?? null) : null
  return {
    id: a.id,
    name: a.name,
    enabled: a.status === 'enabled',
    event: typeof event === 'string' ? event : null,
    emails: a.steps.filter((s) => s.type === 'send_email').length,
    createdAt: a.createdAt,
    url: `https://resend.com/automations/${a.id}`
  }
}

const toDetail = (a: ResendAutomationDetail): RemoteSequenceDetail => ({
  ...toRemoteSequence(a),
  steps: a.steps.map((s) => ({
    key: s.key,
    type: s.type,
    wait: s.type === 'delay' ? String(s.config.duration ?? '') : null
  }))
})

export function resendSequences(client: ResendClient): SequenceEngine {
  const templatesFor = async (
    name: string,
    steps: SequenceStep[],
    from?: string
  ): Promise<string[]> => {
    const ids: string[] = []
    for (const [i, step] of steps.entries()) {
      ids.push(
        await client.createTemplate({
          name: `${name} · ${i + 1}`,
          subject: step.subject,
          html: step.html,
          from
        })
      )
    }
    return ids
  }

  return {
    entryModes: ['event'],
    authoring: true,

    async list() {
      const list = await client.listAutomations()
      const details = await Promise.all(list.map((a) => client.getAutomation(a.id)))
      return details.map(toRemoteSequence)
    },

    async get(id) {
      return toDetail(await client.getAutomation(id))
    },

    async save(draft) {
      if (draft.entry.mode !== 'event')
        throw new CapabilityNotSupported('Resend solo inicia secuencias con un evento.')
      if (draft.id) {
        const current = await client.getAutomation(draft.id)
        if (current.status === 'enabled')
          throw new ProviderRuleViolation(
            'Resend no deja editar una secuencia activa. Páusala primero y vuelve a guardarla.'
          )
      }
      const templates = await templatesFor(draft.name, draft.steps, draft.from)
      const automation = buildDraft(
        draft.name,
        draft.entry.event,
        draft.steps,
        templates,
        draft.enabled
      )
      const id = draft.id ?? (await client.createAutomation(automation))
      if (draft.id) await client.updateAutomation(draft.id, automation)
      return toRemoteSequence(await client.getAutomation(id))
    },

    async setEnabled(id, enabled) {
      await client.updateAutomation(id, { status: enabled ? 'enabled' : 'disabled' })
      return toRemoteSequence(await client.getAutomation(id))
    },

    trigger: (event, email, payload) => client.sendEvent(event, email, payload),

    async enroll() {
      throw new CapabilityNotSupported('Resend no inscribe contactos en secuencias. Usa un evento.')
    },

    async archive() {
      throw new CapabilityNotSupported('Las secuencias de Resend se retiraron de Alisuite.')
    }
  }
}
