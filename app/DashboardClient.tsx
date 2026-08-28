'use client';

import { useState } from 'react';
import {
  auditedSummary,
  boardEntries,
  boardMeta,
  breakdowns,
  dailyPerformance,
  lessons,
  methodology,
  type BoardEntry,
} from '@/lib/dashboard-data';

type BreakdownKey = keyof typeof breakdowns;

const money = (value: number, showPlus = false) =>
  `${showPlus && value > 0 ? '+' : value < 0 ? '−' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value * 100).toFixed(1)}%`;

function HorseRow({ entry, open, onToggle }: { entry: BoardEntry; open: boolean; onToggle: () => void }) {
  return (
    <article className={`horse-row ${open ? 'is-open' : ''}`}>
      <button className="horse-summary" onClick={onToggle} aria-expanded={open}>
        <span className="rank">{String(entry.rank).padStart(2, '0')}</span>
        <span className="horse-name"><strong>{entry.horse}</strong><small>{entry.raceTime} {entry.track} · {entry.raceName}</small></span>
        <span className={`tier ${entry.tier === 'Tier 1' ? 'tier-one' : ''}`}>{entry.tier} · {entry.confidence}</span>
        <span className="market"><strong>{entry.observedOdds}</strong><small>fair {entry.fairOdds}</small></span>
        <span className="row-verdict">{entry.verdict}</span>
        <span className="expand" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="horse-detail">
          <div><span>Why it ranked</span><p>{entry.why}</p></div>
          <div><span>Biggest risk</span><p>{entry.risk}</p></div>
          <div className="price-rule"><span>Price rule</span><strong>Minimum {entry.minimumPrice}</strong><small>Archived price only</small></div>
        </div>
      )}
    </article>
  );
}

export default function DashboardClient() {
  const [openHorse, setOpenHorse] = useState<number | null>(1);
  const [breakdown, setBreakdown] = useState<BreakdownKey>('odds');
  const activeBreakdown = breakdowns[breakdown];
  const maxBar = Math.max(...dailyPerformance.map((item) => Math.abs(item.profitLoss)));
  const maxBreakdown = Math.max(...activeBreakdown.map((item) => Math.abs(item.roi)));

  return (
    <main id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Daly Ventures Racing Intelligence home">
          <span className="brand-mark" aria-hidden="true">DV</span>
          <span><strong>Daly Ventures</strong><small>Racing Intelligence</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#today">Today</a><a href="#performance">Performance</a><a href="#lessons">Lessons</a><a href="#method">Method</a>
        </nav>
        <span className="proof-pill"><i /> Evidence-led</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Horse Club · decision support</p>
          <h1>Signal over noise.<br />Every race day.</h1>
          <p className="hero-deck">The best races, strongest horses and the evidence behind every call—published only after the data clears the gates.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#today">View the latest board <span>↘</span></a>
            <a className="button button-quiet" href="#performance">Explore performance</a>
          </div>
        </div>

        <aside className="live-card" aria-label="Current board status">
          <div className="live-card-top"><span className="status-label status-paused"><i /> Publication paused</span><span className="mono">26 AUG 2026</span></div>
          <div className="live-card-body">
            <p>Today&apos;s board</p><strong>No verified board</strong>
            <span>No current race, runner or price data has passed the publication gates. The archive remains visible below.</span>
          </div>
          <div className="live-card-foot">
            <span><b>0</b> current selections</span><span><b>1</b> archived conflict</span>
          </div>
        </aside>
      </section>

      <section className="board" id="today">
        <div className="section-heading">
          <div><p className="eyebrow">Latest archived research</p><h2>Five horses made the board.</h2></div>
          <div className="freshness"><span>Archived</span><p>{boardMeta.label}<br />prices captured {boardMeta.priceWindow}</p></div>
        </div>

        <div className="integrity-strip" role="note">
          <span className="integrity-icon" aria-hidden="true">!</span>
          <p><strong>This is not a live board.</strong> {boardMeta.note}</p>
          <a href="#method">See publication gates</a>
        </div>

        <div className="horse-table" aria-label="Archived ranked horses">
          <div className="horse-head" aria-hidden="true"><span>Rank / horse</span><span>Signal</span><span>Market</span><span>Why it ranks</span><span /></div>
          {boardEntries.map((entry) => (
            <HorseRow key={entry.rank} entry={entry} open={openHorse === entry.rank} onToggle={() => setOpenHorse(openHorse === entry.rank ? null : entry.rank)} />
          ))}
        </div>
        <div className="board-decision">
          <span className="decision-mark">×</span>
          <div><p>Structure decision</p><strong>No Yankee. No Lucky 15.</strong></div>
          <p>Only three legs cleared the standalone-win test. The method does not invent a fourth.</p>
        </div>
      </section>

      <section className="performance" id="performance">
        <div className="section-heading light-heading">
          <div><p className="eyebrow">Since the first recorded opinion · 18 May 2026</p><h2>What the settled record says.</h2></div>
          <span className="audit-stamp">Audited 26 Aug · USD notional</span>
        </div>

        <div className="kpi-grid">
          <div className="kpi kpi-primary"><span>Corrected settled P/L</span><strong>{money(auditedSummary.profitLoss, true)}</strong><small>{percent(auditedSummary.roi)} ROI · settled rows only</small></div>
          <div className="kpi"><span>Settled tickets</span><strong>{auditedSummary.settledTickets}</strong><small>of {auditedSummary.stakePositiveOpinions} stake-positive opinions</small></div>
          <div className="kpi"><span>Win rate</span><strong>{percent(auditedSummary.winRate).replace('+', '')}</strong><small>{auditedSummary.wins} wins · {auditedSummary.losses} losses · {auditedSummary.voids} voids</small></div>
          <div className="kpi kpi-risk"><span>Still unresolved</span><strong>{auditedSummary.unsettledTickets}</strong><small>{money(auditedSummary.unsettledStake)} notional · excluded from ROI</small></div>
        </div>

        <div className="performance-grid">
          <article className="chart-panel">
            <div className="panel-title"><div><p>Daily settled P/L</p><strong>Volatile path, modest finish</strong></div><span>19 settlement dates</span></div>
            <div className="bar-chart" role="img" aria-label="Daily settled profit and loss from 23 May through 17 June 2026">
              {dailyPerformance.map((item, index) => {
                const height = Math.max(3, (Math.abs(item.profitLoss) / maxBar) * 46);
                return (
                  <div className="bar-column" key={item.isoDate} title={`${item.date}: ${money(item.profitLoss, true)}${item.complete ? '' : ' · partial day'}`}>
                    <span className={`chart-bar ${item.profitLoss >= 0 ? 'positive' : 'negative'} ${item.complete ? '' : 'partial'}`} style={{ height: `${height}%` }} />
                    {(index === 0 || index === dailyPerformance.length - 1 || index === 10) && <small>{item.date}</small>}
                    <span className="sr-only">{item.date}: {money(item.profitLoss, true)}{item.complete ? '' : ', partially settled day'}</span>
                  </div>
                );
              })}
            </div>
            <div className="chart-summary"><span>Start <b>$0</b></span><span>Low point <b>−$204.81</b></span><span>Finish <b>+$71.44</b></span></div>
          </article>

          <aside className="robustness-panel">
            <p className="eyebrow">Robustness check</p><strong>The headline is positive.<br />The evidence is not mature.</strong>
            <div className="sensitivity">
              <span>All settled tickets <b>+3.9%</b></span>
              <span>Remove the largest winner <b className="negative-text">−2.4%</b></span>
              <span>Fully settled days only <b className="negative-text">−4.1%</b></span>
            </div>
            <p>One large return changes the conclusion. The public dashboard therefore shows sensitivity beside ROI, not in a footnote.</p>
          </aside>
        </div>

        <article className="breakdown-panel">
          <div className="breakdown-top">
            <div><p className="eyebrow">Pattern explorer</p><h3>Where the return came from</h3></div>
            <div className="segmented" role="group" aria-label="Choose performance breakdown">
              {(['odds', 'confidence', 'region'] as BreakdownKey[]).map((key) => (
                <button key={key} onClick={() => setBreakdown(key)} aria-pressed={breakdown === key}>{key === 'odds' ? 'Odds band' : key === 'confidence' ? 'Confidence' : 'Region'}</button>
              ))}
            </div>
          </div>
          <div className="breakdown-rows">
            {activeBreakdown.map((item) => (
              <div className="breakdown-row" key={item.label}>
                <div><strong>{item.label}</strong><small>{item.tickets} tickets · {item.note}</small></div>
                <div className="mini-track"><span className={item.roi >= 0 ? 'fill-positive' : 'fill-negative'} style={{ width: `${Math.max(3, Math.abs(item.roi) / maxBreakdown * 100)}%` }} /></div>
                <strong className={item.roi >= 0 ? 'positive-text' : 'negative-text'}>{percent(item.roi)}</strong>
                <span>{money(item.profitLoss, true)}</span>
              </div>
            ))}
          </div>
          <p className="panel-note">Descriptive, not predictive. Small samples and unresolved rows can materially change these patterns.</p>
        </article>

        <div className="data-quality">
          <div><p className="eyebrow">Data-quality exception</p><h3>The workbook total is not the audited total.</h3></div>
          <p>The workbook displays {money(auditedSummary.displayedWorkbookProfitLoss)}, while row-level settled returns imply {money(auditedSummary.profitLoss, true)}. Thirteen settled rows are missing P/L formulas, so the site uses the reconciled settled calculation and labels the exception.</p>
          <span>{auditedSummary.sourceRows} source-log rows</span>
        </div>
      </section>

      <section className="lessons" id="lessons">
        <div className="section-heading">
          <div><p className="eyebrow">Learning log</p><h2>Lessons earn their status.</h2></div>
          <p className="section-deck">Every lesson keeps its observation, evidence and resulting action together. Hypotheses stay quarantined until they can be reproduced.</p>
        </div>
        <div className="lesson-list">
          {lessons.map((lesson, index) => (
            <article className="lesson-card" key={lesson.title}>
              <div className="lesson-meta"><span>{String(index + 1).padStart(2, '0')}</span><time>{lesson.date}</time><b className={`lesson-status ${lesson.status}`}>{lesson.status}</b></div>
              <h3>{lesson.title}</h3><p>{lesson.observation}</p>
              <details><summary>Evidence and action</summary><div><span>Evidence</span><p>{lesson.evidence}</p><span>Action</span><p>{lesson.action}</p></div></details>
            </article>
          ))}
        </div>
      </section>

      <section className="method" id="method">
        <div className="method-intro">
          <p className="eyebrow">Method & governance · rule set v2</p>
          <h2>Data decides what is true.<br />AI explains what it may mean.<br />A human decides what is published.</h2>
          <p>Built around the strongest OpenAI Build Week patterns: a narrow workflow, deterministic state, inspectable evidence, explicit degraded mode and human confirmation.</p>
        </div>
        <div className="method-grid">
          {methodology.map((step) => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}
        </div>
        <div className="gate-panel">
          <div><p className="eyebrow">The publication gate</p><h3>A race stays private unless every required check passes.</h3></div>
          <ul>
            <li><span>01</span>Runner and race confirmed</li><li><span>02</span>Source and timestamp retained</li><li><span>03</span>Price above stated floor</li><li><span>04</span>Structure and exposure pass</li><li><span>05</span>Conflicts resolved or disclosed</li><li><span>06</span>Human approval recorded</li>
          </ul>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark">DV</span><span><strong>Daly Ventures</strong><small>Racing Intelligence</small></span></a>
        <p>Research and decision support only. No wagers are placed. Historical figures are notional, source-bounded and do not guarantee future results.</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
