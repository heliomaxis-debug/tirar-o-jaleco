
// =====================================================================
// REFERÊNCIA DE MERCADO — base da taxa usada na conta
// =====================================================================
// TODO: validar e atualizar todo mês com o time de investimentos da Jaleco & Patrimônio.
const REFERENCIA_MERCADO = {
cdi_12m: 0.1471,             // CDI acumulado em 12 meses: 14,71%
ipca_12m: 0.046,             // IPCA acumulado em 12 meses: 4,6%
aliquota_ir: 0.15,           // imposto de renda sobre o rendimento: 15%
data: "setembro de 2026",
dataCurta: "set/2026",
// Só para a linha de referência da aba 3 (não entra na conta):
tesouroIpcaMaisAnual: 0.07,  // títulos públicos atrelados à inflação: IPCA + 7% a.a.
};
// =====================================================================
// TAXA DE REFERÊNCIA — a única taxa usada na conta
// =====================================================================
// Real (acima da inflação) e líquida de imposto, calculada a partir do CDI:
//   taxa líquida = CDI × (1 − IR)
//   taxa real    = (1 + taxa líquida) / (1 + IPCA) − 1   (≈ 7,56% a.a.)
// Usada no patrimônio necessário, no crescimento e nas simulações da aba 3.
const TAXA_LIQUIDA = REFERENCIA_MERCADO.cdi_12m * (1 - REFERENCIA_MERCADO.aliquota_ir);
const TAXA_REFERENCIA = (1 + TAXA_LIQUIDA) / (1 + REFERENCIA_MERCADO.ipca_12m) - 1;
// Na tela: arredondada para baixo em 1 casa ("cerca de 7,5% ao ano"), pra não prometer a mais.
const TAXA_EXIBIDA = Math.floor(TAXA_REFERENCIA * 1000 + 1e-9) / 1000;
// =====================================================================
// SENSIBILIDADE — "O que move esse número" e curva "Com ajustes" do gráfico
// =====================================================================
// Simulações hipotéticas, com os dados do usuário e a mesma simulação mês a mês:
// - taxaExtraAnual: quanto a mais o patrimônio rende ao ano (GANHO_RENTABILIDADE_PP). Muda só o
//   crescimento; o patrimônio necessário continua medido pela TAXA_REFERENCIA.
// - plantoesExtraMes: quantos plantões a mais por mês viram aporte.
// TODO: validar com o time de investimentos da Jaleco & Patrimônio.
// Pontos percentuais a mais de rendimento ao ano no card "Carteira mais eficiente"
// (e no "Fazendo os dois" e na curva "Com ajustes" do gráfico).
// TODO: validar com investimentos/compliance.
const GANHO_RENTABILIDADE_PP = 1.5;
// Escada de cenários (pontos percentuais a mais ao ano). O GANHO_RENTABILIDADE_PP é marcado
// como referência. TODO: validar com investimentos/compliance.
const CENARIOS_RENTABILIDADE_PP = [1, 1.5, 2, 3];
const SENSIBILIDADE = {
taxaExtraAnual: GANHO_RENTABILIDADE_PP / 100,  // +1,5% a.a.
plantoesExtraMes: 1,   // +1 plantão/mês de aporte
};
// Patrimônio necessário = renda mensal desejada × 250 (retirada de 0,4% ao mês)
const MULTIPLICADOR_META = 250;
const IDADE_LIMITE = 100;          // horizonte da simulação
const GRAFICO_MESES_DEPOIS = 24;   // o gráfico vai até 2 anos depois da meta (no ritmo de hoje)
const ID_GRAFICO_CLIP = "pz-grafico-clip";
const ID_GRAFICO_AREA = "pz-grafico-area";
// =====================================================================
// ESTADO (só em memória — ao recarregar a página, tudo reseta)
// =====================================================================
const estado = {
dados: null,          // respostas das 6 perguntas
pergunta: 0,          // pergunta na tela (0 a 5)
tela: "capa",         // capa | perguntas | lead | resultado
aba: "resultado",     // resultado | como | reduzir
graficoAnimado: false,
lead: null,           // { nome, email, whatsapp, consentimentoEm }
};
// =====================================================================
// FORMATAÇÃO
// =====================================================================
const fmtMoeda = new Intl.NumberFormat("pt-BR", {
style: "currency", currency: "BRL", maximumFractionDigits: 0, minimumFractionDigits: 0,
});
const fmtInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtUmaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtAteUmaCasa = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const moeda = (v) => fmtMoeda.format(Math.round(v));
// até 1 casa: 0,1471 -> "14,7%", 0,15 -> "15%"
const pct1 = (t) => `${fmtAteUmaCasa.format(Math.round(t * 1000) / 10)}%`;
const soDigitos = (s) => (s || "").replace(/\D/g, "");
const lerNumero = (s) => {
const d = soDigitos(s);
return d === "" ? null : Number(d);
};
const plural = (n, um, varios) => (n === 1 ? um : varios);
const plantoesTxt = (n) => `${fmtInteiro.format(n)} ${plural(n, "plantão", "plantões")}`;
// R$ 10,9 milhões · R$ 400 mil · R$ 850
function moedaCurta(v) {
if (v >= 1e6) {
const m = Math.round(v / 1e5) / 10;
return `R$ ${fmtAteUmaCasa.format(m)} ${m < 2 ? "milhão" : "milhões"}`;
}
if (v >= 1e4) return `R$ ${fmtInteiro.format(Math.round(v / 1e3))} mil`;
return moeda(v);
}
// R$ 6,6 mi · R$ 400 mil · R$ 850 (cards e gráfico)
function moedaMi(v) {
if (v >= 1e6) return `R$ ${fmtAteUmaCasa.format(Math.round(v / 1e5) / 10)} mi`;
if (v >= 1e4) return `R$ ${fmtInteiro.format(Math.round(v / 1e3))} mil`;
return moeda(v);
}
// "17,6 anos" / "8 meses"
const anosFmt = (anos) => fmtAteUmaCasa.format(anos);
const tempoTxt = (meses, anos) =>
meses < 12 ? `${meses} ${plural(meses, "mês", "meses")}` : `${anosFmt(anos)} ${anos < 2 ? "ano" : "anos"}`;
// "1,0 plantão" / "2,4 plantões"
const pagosUnidade = (n) => (n < 2 ? "plantão" : "plantões");
// =====================================================================
// CÁLCULO
// =====================================================================
// Taxa mensal equivalente à taxa anual (composta): (1 + a)^(1/12) - 1
const taxaMensalEquivalente = (taxaAnual) => Math.pow(1 + taxaAnual, 1 / 12) - 1;
// Simulação mês a mês (sem fórmula fechada), aporte no início do mês.
// Registra o mês em que cada alvo é atingido (0 = já atingido hoje; null = não atinge no limite).
function simular({ patrimonio, aporte, taxaAnual, alvos, limiteMeses }) {
const taxaMensal = taxaMensalEquivalente(taxaAnual);
const mesesMarco = alvos.map((a) => (patrimonio >= a ? 0 : null));
let saldo = patrimonio;
let meses = 0;
while (mesesMarco.includes(null) && meses < limiteMeses) {
saldo = (saldo + aporte) * (1 + taxaMensal);
meses++;
alvos.forEach((a, i) => {
if (mesesMarco[i] === null && saldo >= a) mesesMarco[i] = meses;
});
}
return { taxaAnual, aporte, mesesMarco };
}
// Saldo mês a mês (índice 0 = hoje), com a mesma regra da simulação — para o gráfico
function serieSaldo(patrimonio, aporte, taxaAnual, meses) {
const tm = taxaMensalEquivalente(taxaAnual);
const s = [patrimonio];
let saldo = patrimonio;
for (let m = 1; m <= meses; m++) {
saldo = (saldo + aporte) * (1 + tm);
s.push(saldo);
}
return s;
}
// A conta: renda passiva desejada -> patrimônio necessário -> quanto falta ->
// tempo e plantões. ajuste (aba 3): { taxaExtra, aporteExtra }.
function calcularConta(d, ajuste = {}) {
const taxaReferencia = TAXA_REFERENCIA;                        // uma taxa só
const taxaMensalRef = taxaMensalEquivalente(taxaReferencia);
// viver do rendimento, sem consumir o principal
const necessario = d.rendaDesejada * MULTIPLICADOR_META;
const falta = Math.max(0, necessario - d.patrimonio);
const limiteMeses = Math.max(0, (IDADE_LIMITE - d.idade) * 12);
const taxaCrescimento = taxaReferencia + (ajuste.taxaExtra || 0);
const aporte = d.aporte + (ajuste.aporteExtra || 0);
const sim = simular({ patrimonio: d.patrimonio, aporte, taxaAnual: taxaCrescimento, alvos: [necessario], limiteMeses });
const meses = sim.mesesMarco[0]; // 0 = já atingido; null = não chega até os 100
const rendaPaga = d.patrimonio / MULTIPLICADOR_META; // mesma regra da meta
return {
taxaReferencia, taxaCrescimento, aporte,
necessario, falta, limiteMeses, meses,
anos: meses === null ? null : Math.round((meses / 12) * 10) / 10,   // 1 casa (17,6)
metaAtingida: d.patrimonio >= necessario,
chegaAte100: meses !== null,
idadeChegada: meses === null ? null : d.idade + Math.floor(meses / 12),
plantoes: meses === null ? null : meses * d.plantoesMes,
plantoesAte100: limiteMeses * d.plantoesMes,
fracaoAtingida: d.patrimonio / necessario,
rendaPaga,
plantoesPagos: Math.round((rendaPaga / d.valorPlantao) * 10) / 10,  // 1 casa, arredondado
};
}
// Diferença entre a conta de hoje e uma conta ajustada (em plantões e em tempo).
// Se hoje não chega até os 100, conta até os 100 (peloMenos = true: o texto diz "até os 100").
function comparar(base, ajustada, d) {
if (base.metaAtingida) return null;
const mesesBase = base.chegaAte100 ? base.meses : base.limiteMeses;
const mesesAjust = ajustada.chegaAte100 ? ajustada.meses : ajustada.limiteMeses;
const mesesAntes = mesesBase - mesesAjust;
return {
plantoesAMenos: mesesAntes * d.plantoesMes,
mesesAntes,
anosAntes: Math.round((mesesAntes / 12) * 10) / 10,  // 1 casa (2,5)
idadeAjustada: ajustada.idadeChegada,
peloMenos: !base.chegaAte100 && ajustada.chegaAte100,
aindaDepoisDos100: !base.chegaAte100 && !ajustada.chegaAte100,
};
}
function calcularSensibilidade(d, base) {
const aporteExtra = d.valorPlantao * SENSIBILIDADE.plantoesExtraMes;
const taxaExtra = SENSIBILIDADE.taxaExtraAnual;
return {
aporteExtra,
taxa: comparar(base, calcularConta(d, { taxaExtra }), d),
aporte: comparar(base, calcularConta(d, { aporteExtra }), d),
juntos: comparar(base, calcularConta(d, { taxaExtra, aporteExtra }), d),
cenarios: CENARIOS_RENTABILIDADE_PP.map((pp) => ({
pp,
r: comparar(base, calcularConta(d, { taxaExtra: pp / 100 }), d),
})),
};
}
// =====================================================================
// NAVEGAÇÃO: capa -> perguntas -> (lead) -> resultado (3 abas)
// =====================================================================
const pagina = document.getElementById("pagina");
const capa = document.getElementById("capa");
const app = document.getElementById("calculadora");
const telas = {
perguntas: document.getElementById("tela-perguntas"),
lead: document.getElementById("tela-lead"),            // desbloqueio: dados antes do resultado
resultado: document.getElementById("tela-resultado"),
agenda: document.getElementById("tela-agenda"),
};
const SUBTITULOS = {
perguntas: "Descubra quantos plantões faltam pra você poder parar",
lead: "Falta só um passo",
resultado: "Seu resultado",
agenda: "Agende sua conversa",
};
// Troca de tela: volta ao topo da página
function rolarAoTopo() {
window.scrollTo({ top: 0, behavior: "instant" });
}
// ---------- Capa em 3 abas: Calculadora · Sobre · Dúvidas ----------
const capaAbas = document.getElementById("capa-abas");
function abrirAbaCapa(nome, rolar = true) {
document.querySelectorAll("[data-capa-painel]").forEach((p) => { p.hidden = p.dataset.capaPainel !== nome; });
capaAbas.querySelectorAll(".capa-aba").forEach((b) => {
if (b.dataset.capaAba === nome) b.setAttribute("aria-current", "true");
else b.removeAttribute("aria-current");
});
if (rolar) rolarAoTopo();
}
capaAbas.querySelectorAll(".capa-aba").forEach((b) => {
b.addEventListener("click", () => {
abrirAbaCapa(b.dataset.capaAba);
rastrear("pz_aba_capa", { aba: b.dataset.capaAba });
});
});
function mostrar(nome) {
estado.tela = nome;
capaAbas.hidden = nome !== "capa";
pagina.classList.toggle("modo-capa", nome === "capa");
const noApp = nome !== "capa";
capa.hidden = noApp;
app.hidden = !noApp;
pagina.classList.toggle("modo-app", noApp);
Object.entries(telas).forEach(([k, el]) => { el.hidden = k !== nome; });
if (noApp) document.getElementById("app-sub").textContent = SUBTITULOS[nome];
document.getElementById("abas").hidden = nome !== "resultado";
app.classList.toggle("com-abas", nome === "resultado");
document.getElementById("btn-editar").hidden = nome !== "resultado";
document.getElementById("barra-perguntas").hidden = nome !== "perguntas";
document.getElementById("barra-cta").hidden = nome !== "resultado";
fecharSheet(false);
rolarAoTopo();
}
// Seta do cabeçalho: pergunta anterior / capa; no resultado, volta à última pergunta
document.getElementById("btn-voltar").addEventListener("click", () => {
if (estado.tela === "agenda") {
abrirResultado();
} else if (estado.tela === "resultado" || estado.tela === "lead") {
mostrar("perguntas");
irParaPergunta(perguntas.length - 1, 0);
} else if (estado.pergunta === 0) {
mostrar("capa");
abrirAbaCapa("calc", false);
document.getElementById("btn-hero").focus({ preventScroll: true });
} else {
irParaPergunta(estado.pergunta - 1, -1);
}
});
// Lápis do cabeçalho: volta às perguntas, já preenchidas
document.getElementById("btn-editar").addEventListener("click", () => {
mostrar("perguntas");
irParaPergunta(0, 0);
});
// "Refazer do zero": limpa as respostas e volta à 1ª pergunta (o cadastro continua)
document.getElementById("btn-refazer").addEventListener("click", () => {
form.reset();
document.querySelectorAll(".pergunta, .campo").forEach((c) => c.classList.remove("invalido"));
estado.dados = null;
document.getElementById("premissas-det").open = false;
document.getElementById("cta-linha").textContent = "Conversa sem compromisso com a Jaleco & Patrimônio";
mostrar("perguntas");
irParaPergunta(0, 0);
});
// =====================================================================
// PERGUNTAS: uma por tela, máscara de milhar, validação na própria tela
// =====================================================================
const form = document.getElementById("form");
const perguntas = [...form.querySelectorAll(".pergunta")];
const btnContinuar = document.getElementById("btn-continuar");
form.querySelectorAll("input").forEach((input) => {
input.addEventListener("input", () => {
const d = soDigitos(input.value).replace(/^0+(?=\d)/, "");
if (input.hasAttribute("data-moeda")) {
input.value = d === "" ? "" : fmtInteiro.format(Number(d.slice(0, 13)));
} else {
input.value = d;
}
input.closest(".pergunta").classList.remove("invalido");
input.closest(".pergunta").querySelector(".erro").textContent = "";
});
// Enter / "Ir" do teclado avança (o botão Continuar fica fora do form, na barra fixa)
input.addEventListener("keydown", (e) => {
if (e.key !== "Enter") return;
e.preventDefault();
form.requestSubmit();
});
});
// Mensagens curtas, por pergunta (chave = name do campo)
const REGRAS = {
idade: (v) => {
if (v === null) return "Informe sua idade.";
if (v < 18 || v > 90) return "Use uma idade entre 18 e 90 anos.";
},
rendaDesejada: (v) => {
if (v === null) return "Informe a renda que você quer por mês.";
if (v <= 0) return "A renda precisa ser maior que zero.";
},
valorPlantao: (v) => {
if (v === null) return "Informe o valor médio do plantão.";
if (v <= 0) return "O valor precisa ser maior que zero.";
},
plantoesMes: (v) => {
if (v === null) return "Informe quantos plantões faz por mês.";
if (v < 1) return "Informe 1 plantão por mês ou mais.";
if (v > 60) return "Confira esse número: parece alto demais.";
},
patrimonio: (v) => {
if (v === null) return "Informe um valor. Se não tiver, coloque 0.";
},
aporte: (v) => {
if (v === null) return "Informe um valor. Se não investe, coloque 0.";
},
};
const inputDa = (i) => perguntas[i].querySelector("input");
function validarPergunta(i) {
const input = inputDa(i);
const valor = lerNumero(input.value);
const msg = REGRAS[input.name](valor);
const p = perguntas[i];
p.classList.toggle("invalido", !!msg);
p.querySelector(".erro").textContent = msg || "";
input.setAttribute("aria-invalid", msg ? "true" : "false");
return msg ? null : valor;
}
// direcao: 1 = avançando, -1 = voltando, 0 = sem animação
function irParaPergunta(i, direcao) {
estado.pergunta = i;
perguntas.forEach((p, k) => {
p.hidden = k !== i;
p.classList.remove("vem-frente");
p.classList.remove("vem-tras");
});
const p = perguntas[i];
if (direcao) void p.offsetWidth; // reinicia a animação
if (direcao > 0) p.classList.add("vem-frente");
if (direcao < 0) p.classList.add("vem-tras");
document.getElementById("progresso-barra").style.width = `${((i + 1) / perguntas.length) * 100}%`;
document.getElementById("progresso-txt").textContent = `${i + 1} de ${perguntas.length}`;
btnContinuar.textContent = i === perguntas.length - 1 ? "Ver meu resultado" : "Continuar";
document.getElementById("btn-voltar").setAttribute("aria-label", i === 0 ? "Voltar ao início" : "Pergunta anterior");
inputDa(i).focus({ preventScroll: true });
}
form.addEventListener("submit", (e) => {
e.preventDefault();
const i = estado.pergunta;
if (validarPergunta(i) === null) {
inputDa(i).focus({ preventScroll: true });
return;
}
if (i < perguntas.length - 1) {
irParaPergunta(i + 1, 1);
return;
}
// última pergunta: confere todas (podem ter sido editadas) e calcula
const dados = {};
for (let k = 0; k < perguntas.length; k++) {
const v = validarPergunta(k);
if (v === null) { irParaPergunta(k, -1); return; }
dados[inputDa(k).name] = v;
}
estado.dados = dados;
// Ainda sem cadastro: pede os dados antes de mostrar o resultado
if (!estado.lead) {
mostrar("lead");
rastrear("pz_desbloqueio_exibido");
} else {
abrirResultado();
}
});
// =====================================================================
// RESULTADO
// =====================================================================
function abrirResultado() {
mostrar("resultado");
estado.graficoAnimado = false;
renderizarResultado();
marcarAba("resultado");
prepararGrafico();
animarAba1();
observarSecoes();
}
const reduzirMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Contagem curta de 0 até o valor (desligada para quem prefere menos movimento)
function contar(el, alvo, formatar) {
if (!el) return;
if (reduzirMovimento()) { el.textContent = formatar(alvo); return; }
const dur = 700;
const t0 = performance.now();
const passo = (t) => {
const p = Math.min(1, (t - t0) / dur);
el.textContent = formatar(alvo * (1 - Math.pow(1 - p, 3)));
if (p < 1) requestAnimationFrame(passo);
};
el.textContent = formatar(0);
requestAnimationFrame(passo);
}
// ---------- Seletor de seções: navegação por âncora numa página só ----------
const ABAS = ["resultado", "como", "reduzir"];
const faixaAbas = document.getElementById("abas");
let travaObservador = 0;     // até quando ignorar o observador (rolagem iniciada por um toque)
let observadorSecoes = null;
// Altura de um menu fixo do site acima da calculadora (0 aqui; na versão Elementor, o menu do tema)
const alturaTopoFixo = () => 0;
faixaAbas.style.top = `${alturaTopoFixo()}px`;
// Espaço ocupado no topo da tela: menu fixo do site + seletor de seções
const ocupadoNoTopo = () => alturaTopoFixo() + faixaAbas.offsetHeight;
function marcarAba(nome) {
estado.aba = nome;
ABAS.forEach((a) => {
const b = document.getElementById("aba-" + a);
if (a === nome) b.setAttribute("aria-current", "true");
else b.removeAttribute("aria-current");
});
}
function irParaSecao(nome) {
const alvo = document.getElementById("painel-" + nome);
const topo = alvo.getBoundingClientRect().top + window.pageYOffset - ocupadoNoTopo() - 12;
const suave = !reduzirMovimento();
marcarAba(nome);
travaObservador = performance.now() + (suave ? 900 : 100);
window.scrollTo({ top: Math.max(0, topo), behavior: suave ? "smooth" : "instant" });
alvo.focus({ preventScroll: true });
}
document.querySelectorAll(".aba").forEach((b) => {
b.addEventListener("click", () => irParaSecao(b.dataset.aba));
});
document.getElementById("btn-entenda").addEventListener("click", () => irParaSecao("como"));
// Ao rolar, o item ativo acompanha a seção visível. O IntersectionObserver avisa
// quando alguma seção cruza uma "linha" logo abaixo do seletor; a ativa é a última
// seção cujo topo já passou dessa linha (no topo da página, "Resultado").
function observarSecoes() {
if (!("IntersectionObserver" in window)) return;
if (observadorSecoes) observadorSecoes.disconnect();
const linha = Math.round(ocupadoNoTopo() + 16);
const resto = Math.max(0, window.innerHeight - linha - 1);
const aoCruzar = () => {
if (performance.now() < travaObservador || estado.tela !== "resultado") return;
let ativa = ABAS[0];
ABAS.forEach((a) => {
if (document.getElementById("painel-" + a).getBoundingClientRect().top <= linha) ativa = a;
});
marcarAba(ativa);
};
const margem = `-${linha}px 0px -${resto}px 0px`;
try {
observadorSecoes = new IntersectionObserver(aoCruzar, { root: document, rootMargin: margem });
} catch (erro) {
observadorSecoes = new IntersectionObserver(aoCruzar, { rootMargin: margem }); // navegadores sem root: document
}
ABAS.forEach((a) => observadorSecoes.observe(document.getElementById("painel-" + a)));
}
// "−480 plantões" / "ainda depois dos 100" (sem "pelo menos": nada que sugira piso de retorno)
function reducaoTxt(r) {
if (r.aindaDepoisDos100) return `ainda depois dos ${IDADE_LIMITE}`;
if (r.plantoesAMenos <= 0) return "sem mudança";
return "−" + plantoesTxt(r.plantoesAMenos);
}
// "2,5 anos antes" / "1,3 ano antes" / "7 meses antes"
function antesTxt(r) {
if (r.mesesAntes >= 12) return `${anosFmt(r.anosAntes)} ${r.anosAntes < 2 ? "ano" : "anos"} antes`;
if (r.mesesAntes >= 1) return `${r.mesesAntes} ${plural(r.mesesAntes, "mês", "meses")} antes`;
return "";
}
// ---------- Textos dos painéis (i), com os dados do usuário ----------
function textosInfo(d, c) {
const taxa = `cerca de ${pct1(TAXA_EXIBIDA)} ao ano acima da inflação`;
const n = d.plantoesMes;
const porMes = `${n} ${plural(n, "plantão", "plantões")} por mês`;
let plantoes, tempo, pagos;
if (c.metaAtingida) {
plantoes = "Seu dinheiro investido já paga a renda que você quer. Não faltam plantões: o plantão já é escolha.";
tempo = `Você já tem ${moedaMi(d.patrimonio)}, mais que os ${moedaMi(c.necessario)} necessários. Rendendo ${taxa}, isso já paga a renda que você quer.`;
} else if (!c.chegaAte100) {
plantoes = `Tempo até seu dinheiro investido pagar a renda que você quer × ${porMes}. No ritmo de hoje, isso passa dos ${IDADE_LIMITE} anos. Contando até lá: ${fmtInteiro.format(c.limiteMeses)} meses × ${n} = ${plantoesTxt(c.plantoesAte100)}.`;
tempo = d.aporte > 0
? `Guardando ${moeda(d.aporte)} por mês, rendendo ${taxa}, você não chega a ${moedaMi(c.necessario)} antes dos ${IDADE_LIMITE} anos.`
: `Só com o que já tem investido, rendendo ${taxa}, você não chega a ${moedaMi(c.necessario)} antes dos ${IDADE_LIMITE} anos.`;
} else {
plantoes = `Tempo até seu dinheiro investido pagar a renda que você quer × ${porMes}. No seu caso: ${fmtInteiro.format(c.meses)} meses × ${n} = ${plantoesTxt(c.plantoes)}.`;
tempo = d.aporte > 0
? `Guardando ${moeda(d.aporte)} por mês, rendendo ${taxa}, você chega a ${moedaMi(c.necessario)} em ${tempoTxt(c.meses, c.anos)}.`
: `Só com o que já tem investido, rendendo ${taxa}, você chega a ${moedaMi(c.necessario)} em ${tempoTxt(c.meses, c.anos)}.`;
}
if (d.patrimonio === 0) {
pagos = "Você ainda não tem nada investido. Quando começar, o rendimento passa a pagar uma parte dos seus plantões.";
} else {
const qtd = c.plantoesPagos === 0 ? "menos de 0,1 plantão" : `${fmtUmaCasa.format(c.plantoesPagos)} ${pagosUnidade(c.plantoesPagos)}`;
pagos = `Pela regra de 0,4% ao mês, seus ${moedaCurta(d.patrimonio)} já permitem retirar cerca de ${moeda(c.rendaPaga)} por mês. Isso equivale a ${qtd} de ${moeda(d.valorPlantao)}.`;
}
return {
plantoes: { titulo: "Plantões que faltam", texto: plantoes },
tempo: { titulo: "Tempo até parar", texto: tempo },
renda: { titulo: "Quanto você quer receber por mês", texto: "O valor que você informou. Tudo na simulação está em valores de hoje." },
necessario: { titulo: "Quanto precisa ter investido", texto: `Multiplicamos a renda que você quer por ${MULTIPLICADOR_META}: ${moeda(d.rendaDesejada)} × ${MULTIPLICADOR_META} = ${moeda(c.necessario)}. Retirar ${moeda(d.rendaDesejada)} por mês é 0,4% desse valor, menos do que ele rende, então o dinheiro não acaba.` },
pagos: { titulo: "Quanto seus investimentos já rendem", texto: pagos },
};
}
function renderizarResultado() {
const d = estado.dados;
if (!d) return;
const c = calcularConta(d);
const $id = (id) => document.getElementById(id);
const porMes = `${d.plantoesMes} ${plural(d.plantoesMes, "plantão", "plantões")}/mês`;
const anosAte100 = IDADE_LIMITE - d.idade;
const porMesExtenso = `${d.plantoesMes} ${plural(d.plantoesMes, "plantão", "plantões")} por mês`;
// ---------- 1. Card principal ----------
const box = $id("r-numero-box");
$id("r-numero-prefixo").textContent = "";
box.classList.remove("texto");
if (c.metaAtingida) {
box.classList.add("texto");
$id("r-numero").textContent = "O plantão já é escolha";
$id("r-numero-linha").textContent = "Seu dinheiro investido já paga a renda que você quer.";
} else if (!c.chegaAte100) {
$id("r-numero-prefixo").textContent = "mais de";
$id("r-numero").textContent = fmtInteiro.format(c.plantoesAte100);
$id("r-numero-linha").textContent = `São ${anosAte100} anos até os ${IDADE_LIMITE} × ${porMesExtenso}.`;
} else {
$id("r-numero").textContent = fmtInteiro.format(c.plantoes);
$id("r-numero-linha").textContent = `São ${tempoTxt(c.meses, c.anos)} no seu ritmo de hoje × ${porMesExtenso}.`;
}
// ---------- 1. Cards ----------
if (c.metaAtingida) {
$id("i-tempo").textContent = "Já chegou";
$id("i-tempo-sub").textContent = "seu dinheiro já paga essa renda";
} else if (!c.chegaAte100) {
$id("i-tempo").textContent = `+ de ${anosAte100} anos`;
$id("i-tempo-sub").textContent = `não chega antes dos ${IDADE_LIMITE}`;
} else {
$id("i-tempo").textContent = tempoTxt(c.meses, c.anos);
$id("i-tempo-sub").textContent = `você chega lá aos ${c.idadeChegada}`;
}
$id("i-renda").textContent = moeda(d.rendaDesejada);
$id("i-necessario").textContent = moedaMi(c.necessario);
const pctTem = c.fracaoAtingida * 100;
$id("i-necessario-sub").textContent = c.metaAtingida
? "você já tem tudo"
: pctTem > 0 && pctTem < 1 ? "você tem menos de 1%" : `você tem ${fmtInteiro.format(Math.floor(pctTem + 0.5))}%`;
$id("i-necessario-barra").style.width = `${Math.min(100, pctTem)}%`;
$id("i-pagos").textContent = d.patrimonio === 0 ? "0" : fmtUmaCasa.format(c.plantoesPagos);
$id("i-pagos-sub").textContent = d.patrimonio === 0
? "você ainda não tem nada investido"
: `${pagosUnidade(c.plantoesPagos)} por mês`;
// ---------- 2. Como chegamos ----------
$id("c-renda").textContent = `${moeda(d.rendaDesejada)}/mês`;
$id("c-necessario").textContent = moedaCurta(c.necessario);
$id("c-necessario-exp").textContent =
`${moeda(d.rendaDesejada)}/mês × ${MULTIPLICADOR_META}. Assim a renda sai do rendimento, sem consumir o patrimônio.`;
$id("c-tem").textContent = moedaCurta(d.patrimonio);
if (c.metaAtingida) {
$id("c-tem-exp").textContent = "Já é o suficiente. Não falta nada.";
} else if (d.patrimonio === 0) {
$id("c-tem-exp").textContent = `Você ainda não tem nada investido. Faltam ${moedaCurta(c.falta)}.`;
} else {
$id("c-tem-exp").textContent = `Faltam ${moedaCurta(c.falta)}.`;
}
const tempoRot = d.aporte > 0 ? `Guardando ${moeda(d.aporte)}/mês, você chega lá em` : "Só com o que já tem investido, você chega lá em";
const contaEl = $id("c-plantoes");
if (c.metaAtingida) {
$id("c-tempo-rot").textContent = "Você chega lá em";
$id("c-tempo").textContent = "Já chegou";
$id("c-tempo-exp").textContent = "Seu dinheiro investido já paga essa renda hoje.";
$id("c-plantoes-rot").textContent = "Plantões que ainda faltam";
contaEl.innerHTML = "<strong>Nenhum</strong>";
} else if (!c.chegaAte100) {
$id("c-tempo-rot").textContent = tempoRot;
$id("c-tempo").textContent = `Mais de ${anosAte100} anos`;
$id("c-tempo-exp").textContent = `Nesse ritmo, não chega lá antes dos ${IDADE_LIMITE} anos.`;
$id("c-plantoes-rot").textContent = `Até os ${IDADE_LIMITE} anos, mantendo sua rotina`;
contaEl.innerHTML = `${fmtInteiro.format(c.limiteMeses)} meses × ${porMes} = <strong>mais de ${plantoesTxt(c.plantoesAte100)}</strong>`;
} else {
$id("c-tempo-rot").textContent = tempoRot;
$id("c-tempo").textContent = tempoTxt(c.meses, c.anos);
$id("c-tempo-exp").textContent = "";
$id("c-plantoes-rot").textContent = "Até lá, mantendo sua rotina";
contaEl.innerHTML = `${fmtInteiro.format(c.meses)} ${plural(c.meses, "mês", "meses")} × ${porMes} = <strong>${plantoesTxt(c.plantoes)}</strong>`;
}
$id("c-nota-taxa").textContent =
`Consideramos um rendimento de cerca de ${pct1(TAXA_EXIBIDA)} ao ano já descontando imposto e inflação.`;
// ---------- 2. Ver detalhes da conta (recolhido) ----------
const detalhes = [
`Base: CDI de ${REFERENCIA_MERCADO.data}, ${pct1(REFERENCIA_MERCADO.cdi_12m)} ao ano.`,
`Descontamos o imposto (${pct1(REFERENCIA_MERCADO.aliquota_ir)}) e a inflação (${pct1(REFERENCIA_MERCADO.ipca_12m)}).`,
`Sobra cerca de ${pct1(TAXA_EXIBIDA)} ao ano de ganho acima da inflação. É com isso que a simulação trabalha.`,
"Se os juros caírem, o prazo aumenta.",
`Referência de hoje (${REFERENCIA_MERCADO.dataCurta}): CDI de ${pct1(REFERENCIA_MERCADO.cdi_12m)} em 12 meses.`,
`Títulos públicos atrelados à inflação pagam cerca de IPCA + ${pct1(REFERENCIA_MERCADO.tesouroIpcaMaisAnual)} ao ano.`,
];
const caixaDetalhes = $id("c-detalhes");
caixaDetalhes.textContent = "";
detalhes.forEach((frase) => {
const par = document.createElement("p");
par.className = "detalhe-texto";
par.textContent = frase;
caixaDetalhes.appendChild(par);
});
// ---------- 3. Como reduzir: destaque, gráfico e alavancas ----------
$id("g-destaque-caixa").hidden = c.metaAtingida;
$id("g-card").hidden = c.metaAtingida;
$id("s-card").hidden = c.metaAtingida;
if (!c.metaAtingida) {
const s = calcularSensibilidade(d, c);
const n = SENSIBILIDADE.plantoesExtraMes;
// TODO: validar com compliance. "pelo menos" só em frase condicional ("Se ..."),
// nunca como afirmação de retorno.
const mesesTxt = (m) => `${fmtInteiro.format(m)} ${plural(m, "mês", "meses")}`;
const ate100 = (r) => r.peloMenos ? `, contando até os ${IDADE_LIMITE}` : "";
const semEfeito = (r) => r.aindaDepoisDos100
? `Mesmo assim, a simulação passa dos ${IDADE_LIMITE} anos.`
: "Não muda o número nesta simulação.";
// linha pequena / número grande / tradução em meses (meses = plantões ÷ plantões por mês)
const alavanca = (chave, se, r, traducao) => {
const seEl = $id(`s-${chave}-se`);
seEl.textContent = "";
const [antes, destaque, depois] = Array.isArray(se) ? se : [se, "", ""];
seEl.append(antes);
if (destaque) { const b = document.createElement("strong"); b.textContent = destaque; seEl.append(b); }
if (depois) seEl.append(depois);
const num = $id(`s-${chave}-num`);
const tem = r.plantoesAMenos > 0;
num.classList.toggle("sem", !tem);
num.textContent = tem ? reducaoTxt(r) : semEfeito(r);
$id(`s-${chave}-trad`).textContent = tem
? `≈ ${traducao(mesesTxt(Math.round(r.plantoesAMenos / d.plantoesMes)))}${ate100(r)}`
: "";
};
alavanca("taxa", ["Se seu dinheiro render ", `apenas ${pct1(SENSIBILIDADE.taxaExtraAnual)} a mais por ano`, ""], s.taxa,
(m) => `${m} inteiros sem dar plantão`);
alavanca("aporte", ["Se investir o valor de ", `${n} ${plural(n, "plantão", "plantões")} a mais por mês`, ""], s.aporte,
(m) => `${m} sem plantão`);
// escada: +1% / +1,5% / +2% / +3%, barra crescente, referência marcada
const escada = $id("s-escada");
escada.textContent = "";
const maior = Math.max(1, ...s.cenarios.map((x) => x.r.plantoesAMenos));
s.cenarios.forEach((x, k) => {
const v = Math.max(0, x.r.plantoesAMenos);
const li = document.createElement("li");
li.className = "degrau";
if (x.pp === GANHO_RENTABILIDADE_PP) li.classList.add("ref");
const ref = document.createElement("span");
ref.className = "degrau-ref";
ref.textContent = x.pp === GANHO_RENTABILIDADE_PP ? "referência" : "";
const valor = document.createElement("span");
valor.className = "degrau-valor";
valor.textContent = v > 0 ? "−" + fmtInteiro.format(v) : "0";
const barra = document.createElement("span");
barra.className = "degrau-barra";
barra.style.height = `${Math.round(8 + 48 * (v / maior))}px`;
barra.style.opacity = String(0.35 + 0.65 * (k / Math.max(1, s.cenarios.length - 1)));
const pp = document.createElement("span");
pp.className = "degrau-pp";
pp.textContent = `+${pct1(x.pp / 100)}`;
li.append(ref, valor, barra, pp);
li.setAttribute("aria-label", `Mais ${pct1(x.pp / 100)} ao ano: ${v > 0 ? plantoesTxt(v) + " a menos" : "não muda"}`);
escada.appendChild(li);
});
const j = s.juntos;
const antes = antesTxt(j);
const temJ = !j.aindaDepoisDos100 && j.plantoesAMenos > 0;
$id("s-juntos-num").textContent = temJ ? reducaoTxt(j) : "";
if (!temJ) {
$id("s-juntos").textContent = semEfeito(j);
$id("s-juntos-anos").textContent = "";
} else {
const m = Math.round(j.plantoesAMenos / d.plantoesMes);
$id("s-juntos").textContent = `São ${mesesTxt(m)} de plantões que saem da sua vida${ate100(j)}.`;
// hoje não chega até os 100: "antes" não tem referência; mostra a idade com os ajustes
$id("s-juntos-anos").textContent = j.peloMenos ? `Você para aos ${j.idadeAjustada}.` : antes ? `Você para ${antes}.` : "";
}
const destaque = $id("g-destaque");
if (s.juntos.aindaDepoisDos100) {
destaque.textContent = `Mesmo com os dois ajustes, não chega lá antes dos ${IDADE_LIMITE} anos.`;
$id("g-destaque-sub").textContent = "Simulação hipotética.";
} else if (s.juntos.peloMenos) {
destaque.innerHTML = `<strong>${reducaoTxt(s.juntos)}</strong> até os ${IDADE_LIMITE} · você para aos ${s.juntos.idadeAjustada}`;
$id("g-destaque-sub").textContent = "Fazendo os dois ajustes abaixo. Simulação hipotética.";
} else {
destaque.innerHTML = `<strong>${reducaoTxt(s.juntos)}</strong>` + (antes ? ` · ${antes}` : "");
$id("g-destaque-sub").textContent = "Fazendo os dois ajustes abaixo. Simulação hipotética.";
}
}
// ---------- 3. Variação "meta já atingida" ----------
// TODO: validar com a Jaleco & Patrimônio os textos da variação "meta já atingida".
if (c.metaAtingida) {
$id("f-titulo").textContent = "Agora, o desafio é proteger e manter.";
$id("f3-titulo").textContent = "Retirada com método";
$id("f3-texto").textContent = "Definimos quanto usar por mês sem gastar o que paga seus plantões.";
$id("fecho").textContent = "É isso que olhamos com você.";
$id("btn-cta").textContent = "Quero falar com a Jaleco & Patrimônio";
} else {
$id("f-titulo").textContent = "Esse número pode ser bem menor.";
$id("f3-titulo").textContent = "Investir todo mês, com método";
$id("f3-texto").textContent = "Definimos quanto do que você ganha vira investimento todo mês.";
$id("fecho").textContent = "É isso que calculamos com você.";
$id("btn-cta").textContent = "Quero reduzir esse número";
}
// ---------- Premissas ----------
$id("premissa-taxa").textContent =
`Valores de hoje, com rendimento de cerca de ${pct1(TAXA_EXIBIDA)} ao ano, já sem imposto e inflação.`;
$id("r-assinatura").textContent =
`Premissas definidas pelo time de investimentos da Jaleco & Patrimônio · atualizado em ${REFERENCIA_MERCADO.data}`;
}
// Contagem nos números da aba 1 (o texto final é o mesmo do renderizarResultado)
function animarAba1() {
const d = estado.dados;
const c = calcularConta(d);
if (!c.metaAtingida) {
contar(document.getElementById("r-numero"), c.chegaAte100 ? c.plantoes : c.plantoesAte100, (v) => fmtInteiro.format(Math.round(v)));
}
if (c.chegaAte100 && c.meses >= 12 && !c.metaAtingida) {
contar(document.getElementById("i-tempo"), c.anos, (v) => `${anosFmt(Math.round(v * 10) / 10)} anos`);
}
contar(document.getElementById("i-renda"), d.rendaDesejada, (v) => moeda(v));
if (d.patrimonio > 0) {
contar(document.getElementById("i-pagos"), c.plantoesPagos, (v) => fmtUmaCasa.format(Math.round(v * 10) / 10));
}
}
// =====================================================================
// GRÁFICO (SVG inline): no ritmo de hoje × com ajustes (hipotético)
// =====================================================================
// O gráfico fica na mesma página: desenha as curvas quando ele aparece na tela.
let observadorGrafico = null;
function prepararGrafico() {
if (observadorGrafico) { observadorGrafico.disconnect(); observadorGrafico = null; }
if (calcularConta(estado.dados).metaAtingida) return;
if (reduzirMovimento() || !("IntersectionObserver" in window)) {
desenharGrafico(false);
return;
}
desenharGrafico(true, false); // curvas recolhidas, esperando aparecer
observadorGrafico = new IntersectionObserver((entradas) => {
if (!entradas.some((e) => e.isIntersecting)) return;
observadorGrafico.disconnect();
observadorGrafico = null;
desenharGrafico(true);
}, { threshold: 0.35 });
observadorGrafico.observe(document.getElementById("g-card"));
}
const grafico = document.getElementById("grafico");
const balao = document.getElementById("balao");
let graficoAtual = null; // dados do último desenho (para o balão)
// Escala "redonda" do eixo Y: 4 divisões
function escalaY(max) {
const passos = [0.25e6, 0.5e6, 1e6, 2e6, 2.5e6, 5e6, 10e6, 20e6, 25e6, 50e6, 100e6];
const passo = passos.find((p) => p * 4 >= max) || Math.ceil(max / 4 / 1e6) * 1e6;
return { passo, max: passo * 4 };
}
function desenharGrafico(animar, iniciarAnimacao = true) {
const d = estado.dados;
const c = calcularConta(d);
const aporteExtra = d.valorPlantao * SENSIBILIDADE.plantoesExtraMes;
const aj = calcularConta(d, { taxaExtra: SENSIBILIDADE.taxaExtraAnual, aporteExtra });
const mesesMeta = c.chegaAte100 ? c.meses : c.limiteMeses;
const totalMeses = Math.max(12, Math.min(c.limiteMeses, mesesMeta + GRAFICO_MESES_DEPOIS));
const base = serieSaldo(d.patrimonio, d.aporte, TAXA_REFERENCIA, totalMeses);
const ajust = serieSaldo(d.patrimonio, d.aporte + aporteExtra, TAXA_REFERENCIA + SENSIBILIDADE.taxaExtraAnual, totalMeses);
const W = Math.max(260, Math.round(grafico.clientWidth || 300));
const H = 230;
const m = { l: 44, r: 14, t: 18, b: 30 };
const pw = W - m.l - m.r, ph = H - m.t - m.b;
const esc = escalaY(Math.max(c.necessario, ajust[totalMeses], base[totalMeses]) * 1.04);
const x = (mes) => m.l + (mes / totalMeses) * pw;
const y = (v) => m.t + (1 - Math.min(v, esc.max) / esc.max) * ph;
const passo = Math.max(1, Math.floor(totalMeses / 90));
const pontos = (serie) => {
const idx = [];
for (let k = 0; k <= totalMeses; k += passo) idx.push(k);
if (idx[idx.length - 1] !== totalMeses) idx.push(totalMeses);
return idx.map((k) => `${x(k).toFixed(1)},${y(serie[k]).toFixed(1)}`);
};
const linhaBase = "M" + pontos(base).join(" L");
const pAjust = pontos(ajust);
const linhaAjust = "M" + pAjust.join(" L");
const area = `${linhaAjust} L${x(totalMeses).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
// eixo X: idades (passo de 2, 5 ou 10 anos)
const anosTotal = totalMeses / 12;
const passoAnos = anosTotal <= 12 ? 2 : anosTotal <= 30 ? 5 : 10;
const ticksX = [];
for (let idade = Math.ceil(d.idade / passoAnos) * passoAnos; idade <= d.idade + anosTotal; idade += passoAnos) {
ticksX.push(idade);
}
const ticksY = [0, 1, 2, 3, 4].map((k) => k * esc.passo);
const rotY = (v) => (v === 0 ? "0" : v >= 1e6 ? `${fmtAteUmaCasa.format(v / 1e6)} mi` : `${fmtInteiro.format(v / 1e3)} mil`);
let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${ariaGrafico(d, c, aj)}">`;
svg += `<defs><linearGradient id="${ID_GRAFICO_AREA}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7a5c" stop-opacity="0.22"/><stop offset="1" stop-color="#0e7a5c" stop-opacity="0"/></linearGradient>`;
svg += `<clipPath id="${ID_GRAFICO_CLIP}"><rect x="0" y="0" width="${animar && !reduzirMovimento() ? m.l : W}" height="${H}"/></clipPath></defs>`;
ticksY.forEach((v) => {
svg += `<line class="g-grade" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
svg += `<text class="g-eixo" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${rotY(v)}</text>`;
});
ticksX.forEach((idade) => {
const xi = x((idade - d.idade) * 12);
svg += `<text class="g-eixo" x="${xi.toFixed(1)}" y="${H - 8}" text-anchor="middle">${idade}</text>`;
});
svg += `<g clip-path="url(#${ID_GRAFICO_CLIP})">`;
svg += `<path d="${area}" fill="url(#${ID_GRAFICO_AREA})"/>`;
svg += `<path class="g-base" d="${linhaBase}"/>`;
svg += `<path class="g-ajuste" d="${linhaAjust}"/>`;
svg += `</g>`;
svg += `<line class="g-meta" x1="${m.l}" x2="${W - m.r}" y1="${y(c.necessario)}" y2="${y(c.necessario)}"/>`;
svg += `<text class="g-meta-txt" x="${m.l + 4}" y="${y(c.necessario) - 7}">Meta: ${moedaMi(c.necessario)}</text>`;
// pontos onde cada curva cruza a meta
svg += `<g class="g-marcas" id="g-marcas" style="opacity:${animar && !reduzirMovimento() ? 0 : 1}">`;
if (aj.chegaAte100 && aj.meses <= totalMeses) {
const xa = x(aj.meses), ya = y(c.necessario);
svg += `<circle class="g-ponto forte" cx="${xa.toFixed(1)}" cy="${ya.toFixed(1)}" r="5"/>`;
svg += `<text class="g-rot forte" x="${(xa - 8).toFixed(1)}" y="${(ya - 10).toFixed(1)}" text-anchor="end">aos ${aj.idadeChegada}</text>`;
}
if (c.chegaAte100) {
const xb = x(c.meses), yb = y(c.necessario);
svg += `<circle class="g-ponto claro" cx="${xb.toFixed(1)}" cy="${yb.toFixed(1)}" r="5"/>`;
svg += `<text class="g-rot claro" x="${Math.min(xb + 8, W - m.r).toFixed(1)}" y="${(yb + 18).toFixed(1)}" text-anchor="${xb + 60 > W ? "end" : "start"}">aos ${c.idadeChegada}</text>`;
}
svg += `</g>`;
svg += `<line class="g-guia" id="g-guia" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>`;
svg += `<circle class="g-ponto forte" id="g-sel-ajuste" r="4.5" cx="0" cy="0" visibility="hidden"/>`;
svg += `<circle class="g-ponto claro" id="g-sel-base" r="4.5" cx="0" cy="0" visibility="hidden"/>`;
svg += `<rect class="g-toque" id="g-toque" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>`;
svg += `</svg>`;
// mantém o balão e troca só o SVG
const antigo = grafico.querySelector("svg");
if (antigo) antigo.remove();
grafico.insertAdjacentHTML("afterbegin", svg);
balao.hidden = true;
graficoAtual = { d, base, ajust, totalMeses, x, y, m, pw, W };
const toque = document.getElementById("g-toque");
toque.addEventListener("pointerdown", mostrarBalao);
toque.addEventListener("pointermove", mostrarBalao);
toque.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") esconderBalao(); });
if (animar && !reduzirMovimento() && iniciarAnimacao) {
const rect = grafico.querySelector("clipPath rect");
const marcas = document.getElementById("g-marcas");
const dur = 1100;
const t0 = performance.now();
const quadro = (t) => {
const p = Math.min(1, (t - t0) / dur);
const e = 1 - Math.pow(1 - p, 3);
rect.setAttribute("width", String(m.l + e * (pw + m.r)));
if (p < 1) requestAnimationFrame(quadro);
else marcas.style.opacity = "1";
};
requestAnimationFrame(quadro);
}
}
function ariaGrafico(d, c, aj) {
const hoje = c.chegaAte100 ? `no ritmo de hoje, aos ${c.idadeChegada}` : `no ritmo de hoje, depois dos ${IDADE_LIMITE}`;
const ajuste = aj.chegaAte100 ? `com ajustes, aos ${aj.idadeChegada}` : `com ajustes, depois dos ${IDADE_LIMITE}`;
return `Gráfico do dinheiro investido por idade. Meta de ${moedaMi(c.necessario)}: ${hoje}; ${ajuste}.`;
}
function mostrarBalao(e) {
const g = graficoAtual;
if (!g) return;
const svg = grafico.querySelector("svg");
const r = svg.getBoundingClientRect();
const escala = g.W / r.width;
const px = (e.clientX - r.left) * escala;
const mes = Math.max(0, Math.min(g.totalMeses, Math.round(((px - g.m.l) / g.pw) * g.totalMeses)));
const xm = g.x(mes);
const guia = document.getElementById("g-guia");
guia.setAttribute("x1", xm);
guia.setAttribute("x2", xm);
guia.setAttribute("visibility", "visible");
[["g-sel-ajuste", g.ajust], ["g-sel-base", g.base]].forEach(([id, serie]) => {
const p = document.getElementById(id);
p.setAttribute("cx", xm);
p.setAttribute("cy", g.y(serie[mes]));
p.setAttribute("visibility", "visible");
});
const idade = g.d.idade + Math.floor(mes / 12);
balao.innerHTML = `<strong>Aos ${idade} anos</strong>Com ajustes: ${moedaMi(g.ajust[mes])}<br>No ritmo de hoje: ${moedaMi(g.base[mes])}`;
balao.hidden = false;
const larg = balao.offsetWidth;
const xTela = xm / escala;
balao.style.left = `${Math.max(0, Math.min(r.width - larg, xTela - larg / 2))}px`;
}
function esconderBalao() {
balao.hidden = true;
["g-guia", "g-sel-ajuste", "g-sel-base"].forEach((id) => {
const el = document.getElementById(id);
if (el) el.setAttribute("visibility", "hidden");
});
}
// redesenha ao girar o celular / mudar a largura (sem animar)
let redimensionando = null;
window.addEventListener("resize", () => {
clearTimeout(redimensionando);
redimensionando = setTimeout(() => {
if (estado.tela !== "resultado" || !estado.dados) return;
observarSecoes();
if (!calcularConta(estado.dados).metaAtingida && grafico.querySelector("svg")) desenharGrafico(false);
}, 150);
});
// =====================================================================
// PAINEL INFERIOR (bottom sheet) dos ícones (i)
// =====================================================================
const sheetFundo = document.getElementById("sheet-fundo");
const sheet = document.getElementById("sheet");
let sheetOrigem = null;
document.querySelectorAll(".info").forEach((b) => {
b.addEventListener("click", () => {
const t = textosInfo(estado.dados, calcularConta(estado.dados))[b.dataset.info];
document.getElementById("sheet-titulo").textContent = t.titulo;
document.getElementById("sheet-texto").textContent = t.texto;
sheetOrigem = b;
sheet.style.transform = "";
sheetFundo.hidden = false;
document.getElementById("sheet-fechar").focus({ preventScroll: true });
});
});
function fecharSheet(devolverFoco = true) {
if (sheetFundo.hidden) return;
sheetFundo.hidden = true;
sheet.style.transform = "";
if (devolverFoco && sheetOrigem) sheetOrigem.focus({ preventScroll: true });
}
document.getElementById("sheet-fechar").addEventListener("click", () => fecharSheet());
sheetFundo.addEventListener("click", (e) => { if (e.target === sheetFundo) fecharSheet(); });
document.addEventListener("keydown", (e) => {
if (e.key === "Escape" && !sheetFundo.hidden) fecharSheet();
});
// arrastar para baixo fecha
let arraste = null;
sheet.addEventListener("pointerdown", (e) => {
if (e.target.closest("button")) return;
arraste = { y0: e.clientY, dy: 0, id: e.pointerId };
sheet.setPointerCapture(e.pointerId);
});
sheet.addEventListener("pointermove", (e) => {
if (!arraste || e.pointerId !== arraste.id) return;
arraste.dy = Math.max(0, e.clientY - arraste.y0);
sheet.style.transform = `translateY(${arraste.dy}px)`;
});
const soltarSheet = (e) => {
if (!arraste || e.pointerId !== arraste.id) return;
const fechar = arraste.dy > 80;
arraste = null;
if (fechar) fecharSheet();
else sheet.style.transform = "";
};
sheet.addEventListener("pointerup", soltarSheet);
sheet.addEventListener("pointercancel", soltarSheet);
// =====================================================================
// CTA (barra fixa do resultado) — abre o agendamento nesta mesma página
// =====================================================================
document.getElementById("btn-cta").addEventListener("click", () => {
abrirAgenda();
});
// =====================================================================
// FUNIL NUMA PÁGINA SÓ: CADASTRO → PERGUNTAS → RESULTADO → AGENDAMENTO
// =====================================================================
const AGENDA_DIAS_UTEIS = 10;
const AGENDA_HORARIOS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const AVISO_PRIVACIDADE_VERSAO = "aviso-privacidade-drive";
// Demonstração: nada sai do navegador. Ligue aqui o seu backend e os seus eventos.
function rastrear(evento, extra) {
console.debug("[evento]", evento, extra || {});
}
function enviarParaPlanilha(campos) {
console.info("[lead não enviado — demonstração]", campos);
return Promise.resolve();
}
const mascaraTel = (v) => {
const d = soDigitos(v).slice(0, 11);
if (d.length > 7) return "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(d.length - 4);
if (d.length > 2) return "(" + d.slice(0, 2) + ") " + d.slice(2);
return d;
};
// ---------- CAPA: todos os botões "Descobrir..." começam as perguntas ----------
document.querySelectorAll(".js-comecar").forEach((b) => {
b.addEventListener("click", () => {
rastrear("pz_simulacao_iniciada");
mostrar("perguntas");
irParaPergunta(0, 0);
});
});
// Respostas e resultado da simulação, no formato enviado à planilha
function camposSimulacao(d) {
const c = calcularConta(d);
return {
plantao_zero_plantoes: !c.metaAtingida && c.chegaAte100 ? Math.round(c.plantoes) : "",
plantao_zero_anos: !c.metaAtingida && c.chegaAte100 ? c.anos : "",
plantao_zero_meta_atingida: c.metaAtingida ? "sim" : "",
pz_idade: d.idade, pz_renda_desejada: d.rendaDesejada, pz_valor_plantao: d.valorPlantao,
pz_plantoes_mes: d.plantoesMes, pz_patrimonio: d.patrimonio, pz_aporte: d.aporte,
};
}
// ---------- DESBLOQUEIO: dados depois das perguntas, antes do resultado ----------
const ldForm = document.getElementById("ld-form");
const ldNome = document.getElementById("ld-nome");
const ldEmail = document.getElementById("ld-email");
const ldTel = document.getElementById("ld-tel");
const ldLgpd = document.getElementById("ld-lgpd");
let cadastroEnviado = "";   // evita linha duplicada se a pessoa reenviar os mesmos dados
ldTel.addEventListener("input", () => { ldTel.value = mascaraTel(ldTel.value); });
// Quem já se cadastrou neste navegador encontra os campos preenchidos
try {
const salvo = JSON.parse(localStorage.getItem("pz_lead") || "null");
if (salvo) {
ldNome.value = salvo.nome || "";
ldEmail.value = salvo.email || "";
ldTel.value = salvo.telefone || "";
}
} catch (e) {}
function marcarLd(input, msg) {
const campo = input.closest(".ld-campo");
campo.classList.toggle("is-invalid", !!msg);
campo.querySelector(".ld-erro").textContent = msg || "";
return !msg;
}
[ldNome, ldEmail, ldTel, ldLgpd].forEach((el) => {
const limpar = () => marcarLd(el, "");
el.addEventListener("input", limpar);
el.addEventListener("change", limpar);
});
ldForm.addEventListener("submit", (e) => {
e.preventDefault();
const ok = [
marcarLd(ldNome, ldNome.value.trim().length < 3 ? "Informe seu nome." : ""),
marcarLd(ldEmail, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ldEmail.value.trim()) ? "" : "Informe um e-mail válido."),
marcarLd(ldTel, soDigitos(ldTel.value).length < 10 ? "Informe seu WhatsApp com DDD." : ""),
marcarLd(ldLgpd, ldLgpd.checked ? "" : "Para ver o resultado, confirme a autorização."),
];
const primeiroErro = [ldNome, ldEmail, ldTel, ldLgpd][ok.indexOf(false)];
if (primeiroErro) { primeiroErro.focus(); return; }
estado.lead = {
nome: ldNome.value.trim(),
email: ldEmail.value.trim(),
whatsapp: ldTel.value.trim(),
consentimentoEm: new Date().toISOString(),
};
try { localStorage.setItem("pz_lead", JSON.stringify({ nome: estado.lead.nome, email: estado.lead.email, telefone: estado.lead.whatsapp })); } catch (err) {}
const d = estado.dados;
const assinatura = [estado.lead.nome, estado.lead.email, estado.lead.whatsapp, JSON.stringify(d)].join("|");
if (assinatura !== cadastroEnviado) {
cadastroEnviado = assinatura;
enviarParaPlanilha(Object.assign({
nome: estado.lead.nome, email: estado.lead.email, telefone: estado.lead.whatsapp,
capital_para_investimento: d ? faixaCapital(d.patrimonio) : "",
renda_mensal: d ? faixaRenda(d.valorPlantao * d.plantoesMes) : "",
dia_reuniao: "", horario_reuniao: "",
origem: "Calculadora Tirar o Jaleco · Cadastro", aviso_privacidade: "aceito",
}, d ? camposSimulacao(d) : {})).catch((err) => console.error("[Jaleco & Patrimônio] Erro ao enviar cadastro:", err));
rastrear("pz_cadastro_enviado");
}
// Não espera a planilha: o resultado abre na hora
abrirResultado();
});
// ---------- AGENDAMENTO ----------
const agDias = document.getElementById("ag-dias");
const agHoras = document.getElementById("ag-horas");
const agTel = document.getElementById("ag-tel");
const agForm = document.getElementById("ag-form");
const agBtn = document.getElementById("ag-btn");
const SEMANA_CURTA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SEMANA_LONGA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const doisDig = (n) => (n < 10 ? "0" : "") + n;
(function montarAgenda() {
const d = new Date(); d.setHours(12, 0, 0, 0);
let n = 0;
while (n < AGENDA_DIAS_UTEIS) {
d.setDate(d.getDate() + 1);
const wd = d.getDay();
if (wd === 0 || wd === 6) continue;
const curta = doisDig(d.getDate()) + "/" + doisDig(d.getMonth() + 1);
const lab = document.createElement("label");
lab.className = "ag-chip";
const inp = document.createElement("input");
inp.type = "radio"; inp.name = "ag-dia"; inp.value = SEMANA_LONGA[wd] + ", " + curta + "/" + d.getFullYear();
const sp = document.createElement("span");
const sm = document.createElement("small"); sm.textContent = SEMANA_CURTA[wd];
sp.append(sm, curta);
lab.append(inp, sp);
agDias.appendChild(lab);
n++;
}
AGENDA_HORARIOS.forEach((h) => {
const lab = document.createElement("label");
lab.className = "ag-chip";
const inp = document.createElement("input");
inp.type = "radio"; inp.name = "ag-hora"; inp.value = h;
const sp = document.createElement("span"); sp.textContent = h;
lab.append(inp, sp);
agHoras.appendChild(lab);
});
})();
const agSelecionado = (nome) => { const el = agForm.querySelector('input[name="' + nome + '"]:checked'); return el ? el.value : ""; };
let agendaIniciada = false;
function atualizarResumoAgenda() {
const dia = agSelecionado("ag-dia"), hora = agSelecionado("ag-hora");
if (dia) agDias.classList.remove("is-invalid");
if (hora) agHoras.classList.remove("is-invalid");
if (!agendaIniciada && (dia || hora)) { agendaIniciada = true; rastrear("pz_agendamento_iniciado"); }
const r = document.getElementById("ag-resumo");
r.textContent = "";
if (dia && hora) {
r.append("Sua preferência: ");
const b = document.createElement("strong"); b.textContent = dia + ", às " + hora; r.append(b);
document.getElementById("ag-erro").textContent = "";
}
}
agDias.addEventListener("change", atualizarResumoAgenda);
agHoras.addEventListener("change", atualizarResumoAgenda);
agTel.addEventListener("input", () => { agTel.value = mascaraTel(agTel.value); agTel.classList.remove("is-invalid"); });
// Faixas no mesmo formato do formulário das LPs, calculadas a partir das respostas
function faixaCapital(v) {
if (v <= 50000) return "Até R$ 50.000";
if (v <= 200000) return "R$ 50.000 a R$ 200.000";
if (v <= 500000) return "R$ 200.000 a R$ 500.000";
if (v <= 1000000) return "R$ 500.000 a R$ 1 milhão";
if (v <= 5000000) return "R$ 1 milhão a R$ 5 milhões";
return "Acima de R$ 5 milhões";
}
function faixaRenda(v) {
if (v <= 5000) return "Até R$ 5.000";
if (v <= 10000) return "R$ 5.000 a R$ 10.000";
if (v <= 20000) return "R$ 10.000 a R$ 20.000";
if (v <= 50000) return "R$ 20.000 a R$ 50.000";
return "Acima de R$ 50.000";
}
function abrirAgenda() {
if (!estado.dados) return;
const c = calcularConta(estado.dados);
const recap = document.getElementById("ag-recap");
if (c.metaAtingida) {
recap.textContent = "Pela sua conta, você já pode parar";
document.getElementById("ag-titulo").textContent = "Vamos proteger o que você já construiu?";
} else if (c.chegaAte100) {
recap.textContent = "Seu resultado: " + plantoesTxt(Math.round(c.plantoes));
document.getElementById("ag-titulo").textContent = "Vamos ver quantos dá pra cortar?";
} else {
recap.textContent = "";
document.getElementById("ag-titulo").textContent = "Vamos ver como chegar lá?";
}
recap.hidden = !recap.textContent;
if (!agTel.value && estado.lead) agTel.value = estado.lead.whatsapp;
document.getElementById("ag-box").hidden = false;
document.getElementById("ag-ok").hidden = true;
document.getElementById("ag-prova").hidden = false;
mostrar("agenda");
rastrear("pz_cta_agendar_clicado");
}
agForm.addEventListener("submit", (e) => {
e.preventDefault();
const dia = agSelecionado("ag-dia"), hora = agSelecionado("ag-hora");
const telOk = soDigitos(agTel.value).length >= 10;
agDias.classList.toggle("is-invalid", !dia);
agHoras.classList.toggle("is-invalid", !hora);
agTel.classList.toggle("is-invalid", !telOk);
if (!dia || !hora) { document.getElementById("ag-erro").textContent = "Escolha um dia e um horário para continuar."; return; }
if (!telOk) { document.getElementById("ag-erro").textContent = "Confira o seu WhatsApp com DDD."; agTel.focus(); return; }
const d = estado.dados;
const c = calcularConta(d);
const lead = estado.lead || { nome: "", email: "", whatsapp: "" };
agBtn.disabled = true;
agBtn.textContent = "Enviando…";
enviarParaPlanilha({
nome: lead.nome, email: lead.email, telefone: agTel.value.trim(),
capital_para_investimento: faixaCapital(d.patrimonio),
renda_mensal: faixaRenda(d.valorPlantao * d.plantoesMes),
dia_reuniao: dia, horario_reuniao: hora,
origem: "Calculadora Tirar o Jaleco · Agendamento", aviso_privacidade: "aceito",
// Resultado e respostas da simulação
plantao_zero_plantoes: !c.metaAtingida && c.chegaAte100 ? Math.round(c.plantoes) : "",
plantao_zero_anos: !c.metaAtingida && c.chegaAte100 ? c.anos : "",
plantao_zero_meta_atingida: c.metaAtingida ? "sim" : "",
pz_idade: d.idade, pz_renda_desejada: d.rendaDesejada, pz_valor_plantao: d.valorPlantao,
pz_plantoes_mes: d.plantoesMes, pz_patrimonio: d.patrimonio, pz_aporte: d.aporte,
})
.then(() => {
preencherConfirmacao(dia, hora, agTel.value.trim());
document.getElementById("ag-box").hidden = true;
document.getElementById("ag-prova").hidden = true;
document.getElementById("app-sub").textContent = "Pré-agendamento recebido";
const ok = document.getElementById("ag-ok");
ok.hidden = false;
ok.focus({ preventScroll: true });
rolarAoTopo();
document.getElementById("cta-linha").textContent = "Pré-agendamento recebido ✓";
rastrear("pz_agendamento_enviado");
})
.catch((err) => {
console.error("[Jaleco & Patrimônio] Erro ao enviar agendamento:", err);
document.getElementById("ag-erro").textContent = "Não conseguimos enviar agora. Tente de novo em instantes.";
})
.finally(() => {
agBtn.disabled = false;
agBtn.textContent = "Confirmar pré-agendamento";
});
});
document.getElementById("ag-voltar").addEventListener("click", abrirResultado);
// ---------- Confirmação final (depois do agendamento) ----------
function preencherConfirmacao(dia, hora, tel) {
const d = estado.dados;
const c = calcularConta(d);
const s = c.metaAtingida ? null : calcularSensibilidade(d, c);
const efeito = (r) => r && !r.aindaDepoisDos100 && r.plantoesAMenos > 0;
const $id = (id) => document.getElementById(id);
const primeiroNome = estado.lead && estado.lead.nome ? estado.lead.nome.trim().split(/\s+/)[0] : "";
$id("ok-nome").textContent = primeiroNome ? ", " + primeiroNome : "";
$id("ok-texto-1").textContent = c.metaAtingida
? "Pela sua simulação, você já pode parar. Na conversa gratuita de 30 minutos, um especialista da Jaleco & Patrimônio olha com você como proteger e manter isso."
: "Com base nas suas respostas, um especialista da Jaleco & Patrimônio vai refazer a sua conta com você, numa conversa gratuita de 30 minutos.";
$id("ok-texto-2").textContent = `Um assessor vai te chamar no WhatsApp ${tel} para confirmar o horário, em até 24 horas úteis.`;
// chips
const chips = $id("ok-chips");
chips.textContent = "";
const chip = (forte, resto) => {
const li = document.createElement("li");
const b = document.createElement("strong"); b.textContent = forte;
li.append(b, resto);
chips.appendChild(li);
};
if (!c.metaAtingida && s && efeito(s.juntos)) chip(`−${fmtInteiro.format(s.juntos.plantoesAMenos)} plantões`, " com ajustes");
chip("30 min", " com especialista");
chip("sem custo", " e sem compromisso");
// resumo
const linhas = [
["Plantões que faltam", c.metaAtingida ? "Nenhum" : c.chegaAte100 ? plantoesTxt(c.plantoes) : "Mais de " + plantoesTxt(c.plantoesAte100)],
];
if (s && efeito(s.juntos)) linhas.push(["Dá pra cortar", "−" + plantoesTxt(s.juntos.plantoesAMenos)]);
linhas.push(["Sua preferência", `${dia}, às ${hora}`]);
linhas.push(["Próximo passo", "Confirmação pelo WhatsApp"]);
const dl = $id("ok-resumo");
dl.textContent = "";
linhas.forEach(([k, v]) => {
const div = document.createElement("div");
const dt = document.createElement("dt"); dt.textContent = k;
const dd = document.createElement("dd"); dd.textContent = v;
div.append(dt, dd);
dl.appendChild(div);
});
// 3 pontos (com os números da pessoa, quando houver)
if (c.metaAtingida) {
$id("ok-p1-t").textContent = "Proteger o que você construiu";
$id("ok-p1").textContent = "Carteira ajustada para manter a renda que você quer, no seu perfil.";
$id("ok-p3-t").textContent = "Retirada com método";
$id("ok-p3").textContent = "Quanto usar por mês sem gastar o que paga a sua renda.";
} else {
$id("ok-p1-t").textContent = "Carteira mais eficiente";
$id("ok-p1").textContent = efeito(s.taxa)
? `Na sua simulação, render ${pct1(SENSIBILIDADE.taxaExtraAnual)} a mais por ano tira ${plantoesTxt(s.taxa.plantoesAMenos)} da conta.`
: "Montada para o seu perfil e o prazo em que você quer parar.";
$id("ok-p3-t").textContent = "Quanto investir por mês";
$id("ok-p3").textContent = efeito(s.aporte)
? `Investir o valor de 1 plantão a mais por mês tira ${plantoesTxt(s.aporte.plantoesAMenos)} da conta.`
: "Definimos quanto do que você ganha vira investimento, todo mês, sem depender de sobrar.";
}
$id("ok-p2-t").textContent = "Menos imposto no caminho";
$id("ok-p2").textContent = "Organizamos como você investe e declara para mais do rendimento ficar com você.";
}
document.getElementById("ok-refazer").addEventListener("click", () => document.getElementById("btn-refazer").click());
