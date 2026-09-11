import { useRef, useState } from 'react'
import {
  euro,
  formatta,
  formattaPercentuale,
  inEuro,
  moduli,
  ralDaNetto,
  calcolaBustaPaga,
  type Contesto,
  type DatiUtente,
  type Kpi,
} from '@iperiva/core'
import { anniDisponibili } from '@iperiva/rules'
import { useStato } from './stato.js'

const MESI = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
]

type Scheda =
  | 'guida'
  | 'dashboard'
  | 'fatture'
  | 'previsione'
  | 'uscite'
  | 'dipendente'
  | 'isee'
  | 'impostazioni'

function valoreKpi(kpi: Kpi, ctx: Contesto): string {
  const v = ctx.valori[kpi.chiave]
  if (v === undefined) return '—'
  switch (kpi.formato) {
    case 'euro':
      return formatta(v)
    case 'percentuale':
      return formattaPercentuale(v)
    case 'numero':
      return v.toLocaleString('it-IT', { maximumFractionDigits: 2 })
    default:
      return String(v)
  }
}

function CampoEuro({
  valore,
  onChange,
  larghezza = 110,
}: {
  valore: number
  onChange: (centesimi: number) => void
  larghezza?: number
}) {
  return (
    <input
      type="number"
      step="0.01"
      style={{ width: larghezza }}
      value={valore === 0 ? '' : inEuro(valore)}
      placeholder="0"
      onChange={(e) => onChange(e.target.value === '' ? 0 : euro(Number(e.target.value)))}
    />
  )
}

export function App() {
  const { dati, aggiorna, risultato, errore, scarica, importa, azzera, caricaEsempio, vuoto } =
    useStato()
  const [scheda, setScheda] = useState<Scheda>(vuoto ? 'guida' : 'dashboard')
  const fileInput = useRef<HTMLInputElement>(null)

  if (errore || !risultato) {
    return (
      <main className="contenitore">
        <h1>Quadro</h1>
        <p className="errore">Il calcolo si è fermato: {errore}</p>
        <button onClick={azzera}>Ricomincia da zero</button>
      </main>
    )
  }

  const { contesto, kpi, moduliCalcolati } = risultato
  const gruppi = [...new Set(kpi.map((k) => k.gruppo))]

  const schede: [Scheda, string, boolean][] = [
    ['guida', 'Come funziona', true],
    ['dashboard', 'Riepilogo', true],
    ['fatture', 'Fatture', true],
    ['previsione', 'Previsionale', moduliCalcolati.includes('previsione')],
    ['uscite', 'Uscite', true],
    ['dipendente', 'Lavoro dipendente', moduliCalcolati.includes('dipendente')],
    ['isee', 'ISEE', moduliCalcolati.includes('isee')],
    ['impostazioni', 'Impostazioni', true],
  ]

  return (
    <div className="contenitore">
      <header>
        <h1>
          I per IVA <small>{dati.profilo.anno}</small>
        </h1>
        <p className="sottotitolo">
          I tuoi dati restano su questo dispositivo. Niente account, niente server.
        </p>
      </header>

      <nav>
        {schede
          .filter(([, , visibile]) => visibile)
          .map(([id, etichetta]) => (
            <button
              key={id}
              className={scheda === id ? 'attiva' : ''}
              onClick={() => setScheda(id)}
            >
              {etichetta}
            </button>
          ))}
      </nav>

      {vuoto && scheda !== 'guida' && (
        <section className="richiamo">
          <p>
            Non c'è ancora nessun dato. Puoi caricare un esempio per vedere come funziona, e
            azzerarlo quando vuoi.
          </p>
          <button onClick={caricaEsempio}>Carica i dati di esempio</button>
        </section>
      )}

      {contesto.avvisi.length > 0 && (
        <section className="avvisi">
          {contesto.avvisi.map((a, i) => (
            <p key={i} className={`avviso ${a.livello}`}>
              <strong>{a.modulo}</strong> {a.messaggio}
            </p>
          ))}
        </section>
      )}

      {scheda === 'guida' && (
        <section className="guida">
          <h2>A cosa serve</h2>
          <p>
            Questo strumento non emette fatture: quello lo fa già il tuo gestionale. Serve a
            rispondere alle domande che il gestionale non affronta. Quanto devo mettere da parte su
            questo bonifico. Quanto mi uscirà a giugno e a novembre, e ce li ho. Se accetto quel
            contratto da dipendente resto nel forfettario. Con che ISEE mi presento.
          </p>

          <h2>Provalo adesso</h2>
          <p>
            Carica i dati di esempio: sono numeri inventati di una partita IVA forfettaria che
            fattura circa 44.000 euro l'anno. Ci giri dentro, guardi i calcoli, e quando hai capito
            come funziona azzeri e metti i tuoi.
          </p>
          <button onClick={caricaEsempio}>Carica i dati di esempio</button>
          <button
            className="pericolo"
            onClick={() => {
              if (confirm('Cancello tutto e ricomincio da zero?')) azzera()
            }}
          >
            Azzera tutto
          </button>

          <h2>Da dove si comincia</h2>
          <ol>
            <li>
              <strong>Impostazioni</strong>: anno, gestione previdenziale e coefficiente di
              redditività. Se non sai il coefficiente, è sulla tua prima fattura o lo sa il
              commercialista.
            </li>
            <li>
              <strong>Impostazioni</strong>, sezione anno precedente: imposta e contributi dovuti
              per l'anno chiuso, presi dalla dichiarazione. Senza questi numeri le scadenze di
              giugno e novembre restano a zero.
            </li>
            <li>
              <strong>Fatture</strong>: una riga per fattura. Quando arriva il bonifico, metti la
              data di incasso. È quella che conta per le tasse.
            </li>
            <li>
              <strong>Uscite</strong>: le tue spese. Mese 0 per quelle ricorrenti, il numero del
              mese per quelle che escono tutte in una volta.
            </li>
            <li>
              <strong>Riepilogo</strong>: la percentuale da spostare sul conto tasse a ogni
              incasso, e il mese in cui la cassa va in sofferenza.
            </li>
          </ol>

          <h2>Accendi solo quello che ti riguarda</h2>
          <p>
            In Impostazioni, in fondo, ci sono i moduli. Se non hai un lavoro dipendente, non
            accendere quel modulo. Se non ti serve l'ISEE, lascialo spento. Quello che spegni
            sparisce anche dal riepilogo.
          </p>

          <h2>I tuoi dati non vanno da nessuna parte</h2>
          <p>
            Restano in questo browser, su questo computer. Non c'è nessun server, nessun account,
            nessuna registrazione. Il rovescio della medaglia: se svuoti la cronologia del browser
            li perdi. Da Impostazioni puoi scaricare un file con tutto e ricaricarlo quando vuoi, o
            su un altro computer.
          </p>

          <h2>Quanto ci si può fidare</h2>
          <p>
            I calcoli di imposta sostitutiva e contributi in Gestione Separata sono verificati con
            scenari di test. Le gestioni Artigiani e Commercianti e le addizionali regionali no:
            trovi l'avviso in cima quando li usi. In ogni caso è uno strumento di pianificazione,
            non una dichiarazione: prima di versare un F24, senti il commercialista.
          </p>
        </section>
      )}

      {scheda === 'dashboard' && (
        <>
          {gruppi.map((gruppo) => (
            <section key={gruppo}>
              <h2>{gruppo}</h2>
              <div className="griglia">
                {kpi
                  .filter((k) => k.gruppo === gruppo)
                  .map((k) => {
                    const stato = k.semaforo?.(contesto)
                    return (
                      <div key={k.chiave} className="scheda">
                        <span className="etichetta">{k.etichetta}</span>
                        <span className="valore">{valoreKpi(k, contesto)}</span>
                        {stato && (
                          <span className={`semaforo ${stato === 'OK' ? 'ok' : 'allerta'}`}>
                            {stato}
                          </span>
                        )}
                        {k.nota && <span className="nota">{k.nota}</span>}
                      </div>
                    )
                  })}
              </div>
            </section>
          ))}

          <section>
            <h2>Andamento mensile</h2>
            <table>
              <thead>
                <tr>
                  <th>Serie</th>
                  {MESI.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(contesto.serie).map(([nome, serie]) => (
                  <tr key={nome}>
                    <th>{nome}</th>
                    {serie.map((v, i) => (
                      <td key={i} className={v < 0 ? 'negativo' : ''}>
                        {formatta(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {scheda === 'fatture' && (
        <section>
          <h2>Fatture e incassi</h2>
          <p className="nota">
            Il forfettario tassa per cassa: conta la data di incasso, non quella della fattura.
          </p>
          <table>
            <thead>
              <tr>
                <th>Data fattura</th>
                <th>Cliente</th>
                <th>Imponibile</th>
                <th>Data incasso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dati.fatture.map((f, i) => (
                <tr key={f.id}>
                  <td>
                    <input
                      type="date"
                      value={f.dataEmissione}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.fatture[i].dataEmissione = e.target.value
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={f.cliente}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.fatture[i].cliente = e.target.value
                        })
                      }
                    />
                  </td>
                  <td>
                    <CampoEuro
                      valore={f.imponibile}
                      onChange={(c) =>
                        aggiorna((d) => {
                          d.fatture[i].imponibile = c
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={f.dataIncasso ?? ''}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.fatture[i].dataIncasso = e.target.value || null
                        })
                      }
                    />
                    {!f.dataIncasso && <span className="tag">da incassare</span>}
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        aggiorna((d) => {
                          d.fatture.splice(i, 1)
                        })
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() =>
              aggiorna((d) => {
                d.fatture.push({
                  id: crypto.randomUUID(),
                  cliente: '',
                  imponibile: 0,
                  dataEmissione: new Date().toISOString().slice(0, 10),
                  dataIncasso: null,
                })
              })
            }
          >
            Aggiungi fattura
          </button>
        </section>
      )}

      {scheda === 'previsione' && (
        <section>
          <h2>Previsionale di fatturato</h2>
          <p className="nota">
            Quanto pensi di fatturare a ogni cliente, mese per mese. È questa la base della
            percentuale di accantonamento a inizio anno.
          </p>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                {MESI.map((m) => (
                  <th key={m}>{m}</th>
                ))}
                <th>Totale</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dati.previsione.map((riga, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={riga.cliente}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.previsione[i].cliente = e.target.value
                        })
                      }
                    />
                  </td>
                  {riga.mesi.map((v, m) => (
                    <td key={m}>
                      <CampoEuro
                        valore={v}
                        larghezza={70}
                        onChange={(c) =>
                          aggiorna((d) => {
                            d.previsione[i].mesi[m] = c
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>{formatta(riga.mesi.reduce((a, b) => a + b, 0))}</td>
                  <td>
                    <button
                      onClick={() =>
                        aggiorna((d) => {
                          d.previsione.splice(i, 1)
                        })
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() =>
              aggiorna((d) => {
                d.previsione.push({ cliente: '', mesi: Array(12).fill(0) })
              })
            }
          >
            Aggiungi cliente
          </button>
        </section>
      )}

      {scheda === 'uscite' && (
        <section>
          <h2>Uscite</h2>
          <p className="nota">
            Mese 0 significa spesa ricorrente, spalmata su dodici mesi. Da 1 a 12 significa che
            esce tutta in quel mese, come il bollo o l'assicurazione.
          </p>
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Voce</th>
                <th>Costo</th>
                <th>Ricorrenze</th>
                <th>Mese</th>
                <th>Risparmio</th>
                <th>Totale</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dati.uscite.map((u, i) => (
                <tr key={u.id}>
                  <td>
                    <input
                      value={u.categoria}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.uscite[i].categoria = e.target.value
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={u.voce}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.uscite[i].voce = e.target.value
                        })
                      }
                    />
                  </td>
                  <td>
                    <CampoEuro
                      valore={u.costoUnitario}
                      onChange={(c) =>
                        aggiorna((d) => {
                          d.uscite[i].costoUnitario = c
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.5"
                      style={{ width: 70 }}
                      value={u.ricorrenze}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.uscite[i].ricorrenze = Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      style={{ width: 60 }}
                      value={u.mese}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.uscite[i].mese = Number(e.target.value)
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.risparmio}
                      onChange={(e) =>
                        aggiorna((d) => {
                          d.uscite[i].risparmio = e.target.checked
                        })
                      }
                    />
                  </td>
                  <td>{formatta(Math.round(u.costoUnitario * u.ricorrenze))}</td>
                  <td>
                    <button
                      onClick={() =>
                        aggiorna((d) => {
                          d.uscite.splice(i, 1)
                        })
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() =>
              aggiorna((d) => {
                d.uscite.push({
                  id: crypto.randomUUID(),
                  categoria: '',
                  voce: '',
                  costoUnitario: 0,
                  ricorrenze: 12,
                  mese: 0,
                  risparmio: false,
                })
              })
            }
          >
            Aggiungi voce
          </button>
        </section>
      )}

      {scheda === 'dipendente' && (
        <SchedaDipendente dati={dati} aggiorna={aggiorna} contesto={contesto} />
      )}

      {scheda === 'isee' && <SchedaIsee dati={dati} aggiorna={aggiorna} />}

      {scheda === 'impostazioni' && (
        <>
          <section>
            <h2>Profilo</h2>
            <label>
              Anno
              <select
                value={dati.profilo.anno}
                onChange={(e) =>
                  aggiorna((d) => {
                    d.profilo.anno = Number(e.target.value)
                  })
                }
              >
                {anniDisponibili.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gestione previdenziale
              <select
                value={dati.profilo.gestione}
                onChange={(e) =>
                  aggiorna((d) => {
                    d.profilo.gestione = e.target.value as DatiUtente['profilo']['gestione']
                  })
                }
              >
                {Object.entries(contesto.regole.previdenza).map(([codice, g]) => (
                  <option key={codice} value={codice}>
                    {g.etichetta}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Coefficiente di redditività
              <select
                value={dati.profilo.coefficiente}
                onChange={(e) =>
                  aggiorna((d) => {
                    d.profilo.coefficiente = Number(e.target.value)
                  })
                }
              >
                {Object.entries(contesto.regole.forfettario.coefficienti).map(([nome, v]) => (
                  <option key={nome} value={v}>
                    {nome.replaceAll('_', ' ')} — {formattaPercentuale(v, 0)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Anno di inizio attività
              <input
                type="number"
                value={dati.profilo.annoInizioAttivita ?? ''}
                onChange={(e) =>
                  aggiorna((d) => {
                    d.profilo.annoInizioAttivita = e.target.value ? Number(e.target.value) : null
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={dati.profilo.agevolazioneStartup}
                onChange={(e) =>
                  aggiorna((d) => {
                    d.profilo.agevolazioneStartup = e.target.checked
                  })
                }
              />
              Applica l'aliquota al 5% nei primi cinque anni
            </label>
            <label>
              Margine di sicurezza sull'accantonamento
              <input
                type="number"
                step="0.01"
                value={dati.profilo.margineSicurezza}
                onChange={(e) =>
                  aggiorna((d) => {
                    d.profilo.margineSicurezza = Number(e.target.value)
                  })
                }
              />
            </label>
          </section>

          <section>
            <h2>Anno precedente</h2>
            <p className="nota">
              Servono per il calendario F24: senza questi numeri le scadenze di giugno e novembre
              restano a zero.
            </p>
            <label>
              Imposta dovuta
              <CampoEuro
                valore={dati.annoPrecedente.impostaDovuta}
                onChange={(c) =>
                  aggiorna((d) => {
                    d.annoPrecedente.impostaDovuta = c
                  })
                }
              />
            </label>
            <label>
              Contributi dovuti
              <CampoEuro
                valore={dati.annoPrecedente.contributiDovuti}
                onChange={(c) =>
                  aggiorna((d) => {
                    d.annoPrecedente.contributiDovuti = c
                  })
                }
              />
            </label>
            <label>
              Acconti già versati
              <CampoEuro
                valore={dati.annoPrecedente.accontiVersati}
                onChange={(c) =>
                  aggiorna((d) => {
                    d.annoPrecedente.accontiVersati = c
                  })
                }
              />
            </label>
            <label>
              Liquidità a inizio anno
              <CampoEuro
                valore={dati.saldoInizialeCassa}
                onChange={(c) =>
                  aggiorna((d) => {
                    d.saldoInizialeCassa = c
                  })
                }
              />
            </label>
            <label>
              Saldo attuale del fondo tasse
              <CampoEuro
                valore={dati.saldoFondoTasse}
                onChange={(c) =>
                  aggiorna((d) => {
                    d.saldoFondoTasse = c
                  })
                }
              />
            </label>
          </section>

          <section>
            <h2>Moduli</h2>
            {moduli().map((m) => (
              <label key={m.id} className="modulo">
                <input
                  type="checkbox"
                  disabled={m.obbligatorio}
                  checked={m.obbligatorio || dati.profilo.moduliAttivi.includes(m.id)}
                  onChange={(e) =>
                    aggiorna((d) => {
                      const attivi = new Set(d.profilo.moduliAttivi)
                      if (e.target.checked) attivi.add(m.id)
                      else attivi.delete(m.id)
                      d.profilo.moduliAttivi = [...attivi]
                    })
                  }
                />
                <span>
                  <strong>{m.etichetta}</strong>
                  {m.obbligatorio && <em> (sempre attivo)</em>}
                  <br />
                  <span className="nota">{m.descrizione}</span>
                </span>
              </label>
            ))}
          </section>

          <section>
            <h2>I tuoi dati</h2>
            <button onClick={scarica}>Scarica il file</button>
            <button onClick={() => fileInput.current?.click()}>Carica un file</button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importa(file)
              }}
            />
            <button
              className="pericolo"
              onClick={() => {
                if (confirm('Cancello tutto e ricomincio da zero?')) azzera()
              }}
            >
              Azzera
            </button>
          </section>
        </>
      )}

      <footer>
        <p>
          Regole fiscali applicate: anno {contesto.regole.anno}
          {contesto.regole.aggiornatoIl && `, aggiornate al ${contesto.regole.aggiornatoIl}`}.
        </p>
        <p>
          Strumento di pianificazione, non una dichiarazione dei redditi e non un consiglio
          professionale. Prima di versare un F24 o di presentare una DSU, verifica con il tuo
          commercialista.
        </p>
      </footer>
    </div>
  )
}

function SchedaDipendente({
  dati,
  aggiorna,
  contesto,
}: {
  dati: DatiUtente
  aggiorna: (fn: (d: DatiUtente) => void) => void
  contesto: Contesto
}) {
  const [nettoObiettivo, setNettoObiettivo] = useState(euro(1400))
  const d = dati.dipendente
  const ralStimata = ralDaNetto(nettoObiettivo * d.mensilita, contesto)
  const verifica = calcolaBustaPaga(ralStimata, contesto)

  return (
    <>
      <section>
        <h2>Contratto</h2>
        <label>
          <input
            type="checkbox"
            checked={d.attivo}
            onChange={(e) =>
              aggiorna((x) => {
                x.dipendente.attivo = e.target.checked
              })
            }
          />
          Contratto attivo
        </label>
        <p className="nota">
          Con il contratto attivo l'aliquota INPS della partita IVA scende, perché hai un'altra
          copertura previdenziale.
        </p>
        <label>
          Mese di inizio
          <input
            type="number"
            min={1}
            max={12}
            value={d.meseInizio}
            onChange={(e) =>
              aggiorna((x) => {
                x.dipendente.meseInizio = Number(e.target.value)
              })
            }
          />
        </label>
        <label>
          Lordo mensile
          <CampoEuro
            valore={d.lordoMensile}
            onChange={(c) =>
              aggiorna((x) => {
                x.dipendente.lordoMensile = c
              })
            }
          />
        </label>
        <label>
          Mensilità
          <select
            value={d.mensilita}
            onChange={(e) =>
              aggiorna((x) => {
                x.dipendente.mensilita = Number(e.target.value)
              })
            }
          >
            {[12, 13, 14].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Redditi da dipendente dell'anno precedente
          <CampoEuro
            valore={d.redditoAnnoPrecedente}
            onChange={(c) =>
              aggiorna((x) => {
                x.dipendente.redditoAnnoPrecedente = c
              })
            }
          />
        </label>
      </section>

      <section>
        <h2>Dal netto al lordo</h2>
        <label>
          Netto mensile che ti offrono
          <CampoEuro valore={nettoObiettivo} onChange={setNettoObiettivo} />
        </label>
        <p>
          RAL corrispondente: <strong>{formatta(ralStimata)}</strong>, cioè{' '}
          <strong>{formatta(Math.round(ralStimata / d.mensilita))}</strong> lordi su {d.mensilita}{' '}
          mensilità. Netto verificato: {formatta(Math.round(verifica.nettoAnnuo / d.mensilita))} al
          mese.
        </p>
      </section>

      <section>
        <h2>Buste paga</h2>
        <p className="nota">
          Inserisci il netto che arriva davvero in banca: prevale sulla simulazione.
        </p>
        <table>
          <thead>
            <tr>
              {MESI.map((m) => (
                <th key={m}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {d.bustePaga.map((v, i) => (
                <td key={i}>
                  <CampoEuro
                    valore={v ?? 0}
                    larghezza={70}
                    onChange={(c) =>
                      aggiorna((x) => {
                        x.dipendente.bustePaga[i] = c === 0 ? null : c
                      })
                    }
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    </>
  )
}

function SchedaIsee({
  dati,
  aggiorna,
}: {
  dati: DatiUtente
  aggiorna: (fn: (d: DatiUtente) => void) => void
}) {
  const campi: [keyof DatiUtente['isee'], string][] = [
    ['redditoForfettario', 'Reddito da regime forfettario'],
    ['redditoDipendente', 'Reddito da lavoro dipendente'],
    ['altriRedditi', 'Altri redditi'],
    ['canoneAnnuo', 'Canone di locazione annuo'],
    ['giacenzaMediaConti', 'Giacenza media di conti e depositi'],
    ['valoreTitoli', 'Valore di ETF, fondi e azioni'],
    ['titoliDiStato', 'Titoli di Stato e buoni postali'],
    ['valoreImuPrimaCasa', 'Valore IMU della prima casa'],
    ['mutuoResiduo', 'Mutuo residuo'],
    ['altriImmobili', 'Altri immobili'],
  ]
  return (
    <section>
      <h2>Simulazione ISEE</h2>
      <p className="nota">
        Servono i redditi di due anni prima e il patrimonio al 31 dicembre dello stesso anno. Per i
        conti conta la giacenza media, non il saldo di fine anno.
      </p>
      <label>
        Componenti del nucleo
        <input
          type="number"
          min={1}
          value={dati.isee.componenti}
          onChange={(e) =>
            aggiorna((d) => {
              d.isee.componenti = Number(e.target.value)
            })
          }
        />
      </label>
      <label>
        Di cui figli conviventi
        <input
          type="number"
          min={0}
          value={dati.isee.figliConviventi}
          onChange={(e) =>
            aggiorna((d) => {
              d.isee.figliConviventi = Number(e.target.value)
            })
          }
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={dati.isee.cittaMetropolitana}
          onChange={(e) =>
            aggiorna((d) => {
              d.isee.cittaMetropolitana = e.target.checked
            })
          }
        />
        Residenza in un capoluogo di città metropolitana
      </label>
      {campi.map(([chiave, etichetta]) => (
        <label key={chiave}>
          {etichetta}
          <CampoEuro
            valore={dati.isee[chiave] as number}
            onChange={(c) =>
              aggiorna((d) => {
                ;(d.isee[chiave] as number) = c
              })
            }
          />
        </label>
      ))}
    </section>
  )
}
