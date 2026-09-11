import { registra } from './registro.js'
import { moduloForfettario } from './moduli/forfettario.js'
import { moduloPrevisione } from './moduli/previsione.js'
import { moduloDipendente } from './moduli/dipendente.js'
import { moduloAcconti } from './moduli/acconti.js'
import { moduloUscite } from './moduli/uscite.js'
import { moduloCassa } from './moduli/cassa.js'
import { moduloPatrimonio } from './moduli/patrimonio.js'
import { moduloIsee } from './moduli/isee.js'
import { moduloRegola503020 } from './moduli/regola-50-30-20.js'

// L'ordine di registrazione non conta: il registro fa l'ordinamento
// topologico in base alle chiavi dichiarate in richiede/fornisce.
registra(moduloPrevisione)
registra(moduloDipendente)
registra(moduloForfettario)
registra(moduloAcconti)
registra(moduloUscite)
registra(moduloCassa)
registra(moduloPatrimonio)
registra(moduloIsee)
registra(moduloRegola503020)

export * from './denaro.js'
export * from './tipi.js'
export * from './registro.js'
export * from './datiIniziali.js'
export * from './datiEsempio.js'
export { calcolaBustaPaga, ralDaNetto, irpefLorda } from './moduli/dipendente.js'
export { contributiPrevidenziali, aliquotaImposta } from './moduli/forfettario.js'
export { valoreNetto as valoreNettoStrumento, TIPI_STRUMENTO } from './moduli/patrimonio.js'
export { totaleUscita } from './moduli/uscite.js'
export { ripartisciSuIncassi } from './moduli/acconti.js'
