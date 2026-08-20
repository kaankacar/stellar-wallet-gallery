import { useEffect, useState } from "react";
import { Button } from "./ui";

export type FlowActor = { id: string; label: string; icon: string };
export type FlowStep = { from: string; to: string; label: string; detail: string };
export type SetupStep = { title: string; detail?: string; code?: string };

export type SigningExplainerContent = {
  actors: FlowActor[];
  steps: FlowStep[];
  setup: SetupStep[];
  footnote?: string;
};

const W = 640;
const TOP = 64;
const ROW = 48;

/**
 * Two-panel explainer: "Get it running" (setup: install, keys, wiring) on the
 * left, and an interactive sequence diagram of the kit's signing flow on the
 * right. Steps advance by click, Prev/Next, or autoplay; the active hop is
 * signaled by thickness, animation, its number, and the caption below — never
 * by color alone.
 */
export function SigningExplainer(props: SigningExplainerContent) {
  const { actors, steps } = props;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setActive((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [playing, steps.length]);

  const H = TOP + steps.length * ROW + 12;
  const laneX = (i: number) => Math.round(((i + 0.5) / actors.length) * W);
  const xOf = (id: string) => laneX(actors.findIndex((a) => a.id === id));

  const select = (i: number) => {
    setPlaying(false);
    setActive(i);
  };

  return (
    <section className="explainer">
      <div className="explainer-grid">
        <div className="card">
          <h2>Get it running</h2>
          <ol className="setup">
            {props.setup.map((s, i) => (
              <li key={i}>
                <span className="setup-title">{s.title}</span>
                {s.detail && <p className="muted small">{s.detail}</p>}
                {s.code && (
                  <pre className="code">
                    <code>{s.code}</code>
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <h2>Under the hood: signing a payment</h2>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="flow"
            role="img"
            aria-label="Signing flow diagram — use the Prev and Next buttons to step through"
          >
            <defs>
              <marker id="ah-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="ah ah-dim" />
              </marker>
              <marker id="ah-done" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="ah ah-done" />
              </marker>
              <marker id="ah-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="ah ah-active" />
              </marker>
            </defs>

            {actors.map((a, i) => (
              <g key={a.id}>
                <line x1={laneX(i)} y1={TOP - 12} x2={laneX(i)} y2={H - 6} className="lifeline" />
                <text x={laneX(i)} y={24} textAnchor="middle" className="actor-icon">
                  {a.icon}
                </text>
                <text x={laneX(i)} y={44} textAnchor="middle" className="actor-label">
                  {a.label}
                </text>
              </g>
            ))}

            {steps.map((s, i) => {
              const y = TOP + i * ROW + 26;
              const x1 = xOf(s.from);
              const x2 = xOf(s.to);
              const state = i === active ? "active" : i < active ? "done" : "dim";
              const marker = `url(#ah-${state})`;
              const self = s.from === s.to;
              const dir = x1 < W / 2 ? 1 : -1;
              return (
                <g key={i} className={`step ${state}`} onClick={() => select(i)}>
                  <rect
                    x={0}
                    y={y - ROW / 2 - 2}
                    width={W}
                    height={ROW}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                  />
                  {self ? (
                    <path
                      d={`M ${x1} ${y - 6} C ${x1 + dir * 52} ${y - 6}, ${x1 + dir * 52} ${y + 12}, ${x1 + dir * 8} ${y + 12}`}
                      className="edge"
                      fill="none"
                      markerEnd={marker}
                    />
                  ) : (
                    <line
                      x1={x1}
                      y1={y}
                      x2={x2 + (x2 > x1 ? -8 : 8)}
                      y2={y}
                      className="edge"
                      markerEnd={marker}
                    />
                  )}
                  <circle cx={x1} cy={self ? y - 6 : y} r={3.5} className="edge-dot" />
                  <text
                    x={self ? x1 + dir * 12 : (x1 + x2) / 2}
                    y={y - 10}
                    textAnchor={self ? (dir > 0 ? "start" : "end") : "middle"}
                    className="edge-label"
                  >
                    {i + 1}. {s.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="flow-caption" aria-live="polite">
            <strong>
              Step {active + 1}/{steps.length}
            </strong>{" "}
            — {steps[active].detail}
          </div>

          <div className="row">
            <Button variant="ghost" onClick={() => select(Math.max(0, active - 1))} disabled={active === 0}>
              ← Prev
            </Button>
            <Button
              variant="ghost"
              onClick={() => select(Math.min(steps.length - 1, active + 1))}
              disabled={active === steps.length - 1}
            >
              Next →
            </Button>
            <Button
              onClick={() => {
                if (!playing && active >= steps.length - 1) setActive(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "⏸ Pause" : "▶ Play the flow"}
            </Button>
          </div>

          {props.footnote && <p className="muted small">{props.footnote}</p>}
        </div>
      </div>
    </section>
  );
}
