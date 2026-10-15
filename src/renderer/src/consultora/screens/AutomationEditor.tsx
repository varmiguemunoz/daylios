import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, X } from 'lucide-react'
import {
  clone,
  insert,
  isDestructive,
  issuesByNode,
  newNode,
  newTrigger,
  portsOf,
  removeNode,
  removeSubtree,
  setParams,
  validateDefinition,
  type AutomationDetail,
  type NodeType,
  type RunView,
  type TriggerType
} from '@shared/automations'
import { SegmentedToggle } from '../../ui'
import { errorMessage } from '../../lib/api'
import { useUiState } from '../../lib/ui-state'
import { useGoneRedirect, useScreenTitle } from '../chrome'
import { attempt } from '../lib'
import { EditableText, ErrorNote, Page } from '../ui'
import { useAutomationDraft } from '../hooks/useAutomationDraft'
import { useLiveLoad } from '../hooks/useLiveLoad'
import { useTreeDrag } from '../hooks/useTreeDrag'
import { Canvas, pasteAt } from '../organisms/automation/Canvas'
import {
  EditorContext,
  namesFrom,
  type Editor,
  type Selection
} from '../organisms/automation/context'
import { NodePanel } from '../organisms/automation/NodePanel'
import { NodePicker } from '../organisms/automation/NodePicker'
import { PublishBar } from '../organisms/automation/PublishBar'
import { RunDrawer } from '../organisms/automation/RunDrawer'
import { RunManualModal } from '../organisms/automation/RunManualModal'
import { RunsTable } from '../organisms/automation/RunsTable'
import { SettingsTab } from '../organisms/automation/SettingsTab'
import { StepsTable } from '../organisms/automation/StepsTable'
import { TestDrawer } from '../organisms/automation/TestDrawer'
import { TriggerPanel } from '../organisms/automation/TriggerPanel'
import { VersionsModal } from '../organisms/automation/VersionsModal'

const automations = window.api.automations
type Tab = 'canvas' | 'settings' | 'runs' | 'log'
const TABS: { id: Tab; label: string }[] = [
  { id: 'canvas', label: 'Lienzo' },
  { id: 'settings', label: 'Ajustes' },
  { id: 'runs', label: 'Inscripciones' },
  { id: 'log', label: 'Registro' }
]

const typing = (e: KeyboardEvent): boolean =>
  Boolean(
    (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')
  )

function EditorBody({
  detail,
  back
}: {
  detail: AutomationDetail
  back: () => void
}): React.JSX.Element {
  const id = detail.automation.id
  const draft = useAutomationDraft(id, detail.automation.draft)
  const { def, apply } = draft
  const optionsLoad = useCallback(() => automations.options(), [])
  const { data: options } = useLiveLoad(optionsLoad)
  const [tab, setTab] = useState<Tab>('canvas')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [clipboard, setClipboard] = useState<Editor['clipboard']>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [statsOn, setStatsOn] = useUiState('automations.stats', false)
  const [path, setPath] = useState<Set<string> | null>(null)
  const [run, setRun] = useState<RunView | null>(null)
  const [testing, setTesting] = useState(false)
  const [manual, setManual] = useState(false)
  const [versions, setVersions] = useState(false)
  const drag = useTreeDrag(def)

  const statsLoad = useCallback(
    () => (statsOn ? automations.stats(id) : Promise.resolve(null)),
    [id, statsOn]
  )
  const { data: stats } = useLiveLoad(statsLoad)

  const refs = useMemo(
    () =>
      options
        ? {
            pipeline: new Set(options.pipelines.map((p) => p.id)),
            stage: new Set(options.stages.map((s) => s.id)),
            client: new Set(options.clients.map((c) => c.id)),
            project: new Set(options.projects.map((p) => p.id))
          }
        : {},
    [options]
  )
  const issueList = useMemo(() => validateDefinition(def, refs), [def, refs])
  const issues = useMemo(() => issuesByNode(issueList), [issueList])
  const names = useMemo(() => namesFrom(options, def), [options, def])

  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => setMessage(null), 6000)
    return () => window.clearTimeout(t)
  }, [message])

  const notify = useCallback((m: string | null) => setMessage(m), [])

  const editor: Editor = {
    def,
    apply,
    options,
    names,
    issues,
    selection,
    select: setSelection,
    drag,
    stats: statsOn ? stats : null,
    path,
    clipboard,
    setClipboard: (f) => {
      setClipboard(f)
      if (f) setMessage('Copiado. Haz clic en un «+» para pegarlo.')
    },
    notify
  }

  useEffect(() => {
    if (tab !== 'canvas') return
    const key = (e: KeyboardEvent): void => {
      if (typing(e)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) draft.redo()
        else draft.undo()
      } else if (mod && e.key.toLowerCase() === 'c' && selection?.kind === 'node') {
        e.preventDefault()
        editor.setClipboard(clone(def, selection.id, e.shiftKey ? 'subtree' : 'node'))
      } else if (mod && e.key.toLowerCase() === 'v' && selection?.kind === 'slot' && clipboard) {
        e.preventDefault()
        notify(apply((d) => pasteAt(d, selection.slot, clipboard)))
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection?.kind === 'node') {
        const node = def.nodes[selection.id]
        if (node && portsOf(node).length <= 1) {
          e.preventDefault()
          setSelection(null)
          notify(apply((d) => removeNode(d, node.id)))
        }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const publish = async (ack: boolean): Promise<void> => {
    await draft.flush()
    setMessage(await attempt(() => automations.publish(id, { acknowledgeDestructive: ack })))
  }

  const toggle = async (): Promise<void> =>
    setMessage(
      await attempt(() =>
        automations.setStatus(id, detail.automation.status === 'active' ? 'paused' : 'active')
      )
    )

  const restored = async (): Promise<void> => {
    setVersions(false)
    try {
      draft.reset((await automations.get(id)).automation.draft)
    } catch (e) {
      setMessage(errorMessage(e))
    }
  }

  const showIssues = (): void => {
    const targets = [
      ...new Set(
        issueList.map((i) => i.nodeId ?? i.triggerId).filter((x): x is string => Boolean(x))
      )
    ]
    setTab('canvas')
    if (!targets.length) {
      setMessage(issueList[0]?.message ?? null)
      return
    }
    const current =
      selection?.kind === 'node' || selection?.kind === 'trigger' ? selection.id : null
    const next = targets[(targets.indexOf(current ?? '') + 1) % targets.length]
    setSelection(def.nodes[next] ? { kind: 'node', id: next } : { kind: 'trigger', id: next })
  }

  const pickNode = (type: string): void => {
    if (selection?.kind !== 'slot') return
    const node = newNode(type as NodeType)
    const failed = apply((d) => insert(d, selection.slot, node))
    if (failed) setMessage(failed)
    else setSelection({ kind: 'node', id: node.id })
  }

  const pickTrigger = (type: string): void => {
    const trigger = newTrigger(type as TriggerType)
    apply((d) => ({ ...d, triggers: [...d.triggers, trigger] }))
    setSelection({ kind: 'trigger', id: trigger.id })
  }

  const panel = ((): React.JSX.Element | null => {
    const close = (): void => setSelection(null)
    if (!selection) return null
    if (selection.kind === 'slot')
      return (
        <NodePicker
          mode="node"
          subject={def.subject}
          onPick={pickNode}
          onPaste={
            clipboard
              ? () => {
                  const failed = apply((d) => pasteAt(d, selection.slot, clipboard))
                  setMessage(failed)
                  if (!failed) close()
                }
              : undefined
          }
          onDragStart={(type, e) => drag.start({ kind: 'new', type }, e)}
          onDragEnd={drag.end}
          onClose={close}
        />
      )
    if (selection.kind === 'add-trigger')
      return (
        <NodePicker mode="trigger" subject={def.subject} onPick={pickTrigger} onClose={close} />
      )
    if (selection.kind === 'trigger') {
      const trigger = def.triggers.find((t) => t.id === selection.id)
      if (!trigger) return null
      return (
        <TriggerPanel
          key={trigger.id}
          def={def}
          trigger={trigger}
          options={options}
          issues={issues[trigger.id] ?? []}
          onSave={(params, conditions) =>
            apply((d) => ({
              ...d,
              triggers: d.triggers.map((t) =>
                t.id === trigger.id ? { ...t, params, conditions } : t
              )
            }))
          }
          onDelete={() => {
            close()
            apply((d) => ({ ...d, triggers: d.triggers.filter((t) => t.id !== trigger.id) }))
          }}
          onClose={close}
        />
      )
    }
    const node = def.nodes[selection.id]
    if (!node) return null
    return (
      <NodePanel
        key={node.id}
        def={def}
        node={node}
        options={options}
        issues={issues[node.id] ?? []}
        onSave={(params, name) => setMessage(apply((d) => setParams(d, node.id, params, name)))}
        onDelete={(keep) => {
          close()
          setMessage(
            apply((d) =>
              keep === '' ? removeSubtree(d, node.id) : removeNode(d, node.id, keep ?? undefined)
            )
          )
        }}
        onClose={close}
      />
    )
  })()

  return (
    <EditorContext.Provider value={editor}>
      <Page
        variant="board"
        title={
          <EditableText
            label="Nombre de la automatización"
            value={detail.automation.name}
            onSave={(name) => void attempt(() => automations.rename(id, name)).then(setMessage)}
          />
        }
        actions={
          <PublishBar
            status={detail.automation.status}
            versionNumber={detail.automation.versionNumber}
            issues={issueList.length}
            hasDraftChanges={detail.hasDraftChanges}
            saving={draft.saving}
            destructive={isDestructive(def)}
            onPublish={(ack) => void publish(ack)}
            onToggle={() => void toggle()}
            onIssues={showIssues}
            onVersions={() => setVersions(true)}
            onTest={() => setTesting(true)}
            onRun={() => setManual(true)}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pb-3">
            <SegmentedToggle label="Vista" value={tab} options={TABS} onChange={setTab} />
            {tab === 'canvas' && (
              <button
                type="button"
                aria-pressed={statsOn}
                onClick={() => setStatsOn(!statsOn)}
                className={`flex h-[30px] items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] ${
                  statsOn
                    ? 'bg-ob-accent/15 text-ob-link'
                    : 'text-ob-muted hover:bg-ob-hover hover:text-ob-text'
                }`}
              >
                <BarChart3 size={14} aria-hidden />
                Estadísticas
              </button>
            )}
            {tab === 'canvas' && statsOn && (
              <span className="text-[12px] text-ob-faint">
                En cada paso: pasaron · <span className="text-ob-yellow">esperan</span> ·{' '}
                <span className="text-ob-red">fallaron</span>
              </span>
            )}
            {tab === 'canvas' && path && (
              <button
                type="button"
                onClick={() => setPath(null)}
                className="flex h-[26px] items-center gap-1 rounded-full bg-ob-accent/15 px-2.5 text-[12px] text-ob-link hover:bg-ob-accent/25"
              >
                Camino de una ejecución
                <X size={12} aria-hidden />
              </button>
            )}
            <span className="flex-1" />
            {draft.error && (
              <span className="text-[12px] text-ob-red">No se guardó: {draft.error}</span>
            )}
          </div>
          {message && (
            <div className="shrink-0 px-6 pb-2">
              <ErrorNote message={message} />
            </div>
          )}
          <div className="flex min-h-0 flex-1 border-t border-ob-border">
            {tab === 'canvas' && (
              <>
                <div className="min-w-0 flex-1">
                  <Canvas
                    canUndo={draft.canUndo}
                    canRedo={draft.canRedo}
                    onUndo={draft.undo}
                    onRedo={draft.redo}
                  />
                </div>
                {panel}
              </>
            )}
            {tab !== 'canvas' && (
              <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                {tab === 'settings' && (
                  <SettingsTab
                    def={def}
                    names={names}
                    onChange={(settings) => apply((d) => ({ ...d, settings }))}
                    onDelete={() =>
                      void attempt(() => automations.remove(id)).then((failed) =>
                        failed ? setMessage(failed) : back()
                      )
                    }
                  />
                )}
                {tab === 'runs' && (
                  <div className="px-6 pb-16">
                    <RunsTable automationId={id} onOpen={setRun} />
                  </div>
                )}
                {tab === 'log' && (
                  <div className="px-6 pb-16">
                    <StepsTable automationId={id} def={def} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Page>
      <RunDrawer
        run={run}
        onClose={() => setRun(null)}
        nameOf={(nodeId) => def.nodes[nodeId]?.name}
        onShowPath={(ids) => {
          setPath(new Set(ids))
          setRun(null)
          setTab('canvas')
        }}
      />
      <TestDrawer open={testing} id={id} def={def} onClose={() => setTesting(false)} />
      <RunManualModal
        open={manual}
        id={id}
        subject={def.subject}
        onClose={() => setManual(false)}
      />
      <VersionsModal
        open={versions}
        id={id}
        onClose={() => setVersions(false)}
        onRestored={() => void restored()}
      />
    </EditorContext.Provider>
  )
}

export function AutomationEditor({
  id,
  back
}: {
  id: string
  back: () => void
}): React.JSX.Element {
  const load = useCallback(() => automations.get(id), [id])
  const { data, error } = useLiveLoad(load)
  useScreenTitle(data?.automation.name)
  useGoneRedirect(error)
  if (!data) return <div className="p-6">{error && <ErrorNote message={error} />}</div>
  return <EditorBody key={id} detail={data} back={back} />
}
