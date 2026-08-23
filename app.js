const BACKEND_URL = "https://electrizemonitorsp.onrender.com";

function pegarCodigoDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("c");
}

// Converte campos com escala fixa do manual (ex: tensão em 0.1V vira volts reais)
function escala(valor, divisor, casasDecimais = 1) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return (Number(valor) / divisor).toFixed(casasDecimais);
}

function badgeStatus(status) {
  const s = Number(status);
  if (s === 1) return `<span class="status-badge status-online">🟢 Online</span>`;
  if (s === 2) return `<span class="status-badge status-warning">🟡 Atenção</span>`;
  if (s === 3) return `<span class="status-badge status-offline">🔴 Erro</span>`;
  return `<span class="status-badge status-offline">🔴 Offline</span>`;
}

// --- Monta o alerta de dias offline, quando a planta está desconectada ---
function alertaOffline(status, ludt) {
  const s = Number(status);
  const estaOffline = s !== 1 && s !== 2 && s !== 3;
  if (!estaOffline || !ludt) return "";

  const dataUltimaLeitura = new Date(ludt.replace(" ", "T"));
  if (isNaN(dataUltimaLeitura.getTime())) return "";

  const diffMs = new Date() - dataUltimaLeitura;
  const dias = Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);

  const dataFormatada = dataUltimaLeitura.toLocaleDateString("pt-BR");

  return `
    <div style="background: #ff6b6b15; border: 1px solid #ff6b6b40; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
      <div style="font-size: 13px; color: #ff6b6b;">A planta está offline desde o dia ${dataFormatada}.</div>
      <div style="margin-top: 6px;">
        <span style="font-size: 32px; font-weight: 800; color: #ff6b6b;">${dias}</span>
        <span style="font-size: 13px; color: #ff6b6b;"> dia${dias === 1 ? "" : "s"} descontado${dias === 1 ? "" : "s"} da internet</span>
      </div>
    </div>
  `;
}

function secaoOverview(overview, curvaDia) {
  if (!overview) return "";
  return `
    <div class="card">
      <h2>Visão geral</h2>
      ${badgeStatus(overview.status)}
      ${alertaOffline(overview.status, overview.ludt)}
      <div class="grid">
        <div><div class="metric-label">Hoje</div><div class="metric-value">${overview["E-Today"]?.value ?? "-"} <span class="metric-unit">${overview["E-Today"]?.unit ?? ""}</span></div></div>
        <div><div class="metric-label">Este mês</div><div class="metric-value">${overview["E-Month"]?.value ?? "-"} <span class="metric-unit">${overview["E-Month"]?.unit ?? ""}</span></div></div>
        <div><div class="metric-label">Total</div><div class="metric-value">${overview["E-Total"]?.value ?? "-"} <span class="metric-unit">${overview["E-Total"]?.unit ?? ""}</span></div></div>
        <div><div class="metric-label">Este ano</div><div class="metric-value">${overview["E-Year"]?.value ?? "-"} <span class="metric-unit">${overview["E-Year"]?.unit ?? ""}</span></div></div>
        <div><div class="metric-label">Potência agora</div><div class="metric-value">${overview.Power?.value ?? "-"} <span class="metric-unit">${overview.Power?.unit ?? ""}</span></div></div>
        <div><div class="metric-label">CO2 evitado</div><div class="metric-value">${overview.CO2Avoided?.value ?? "-"} <span class="metric-unit">${overview.CO2Avoided?.unit ?? ""}</span></div></div>
        <div><div class="metric-label">Yield</div><div class="metric-value">${overview.TotalYield?.value ?? "-"}</div></div>
      </div>
      <div class="atualizado">Última atualização: ${overview.ludt ?? "-"}</div>
      <div style="margin-top: 16px;">
        <div class="metric-label" style="margin-bottom: 8px;">Potência ao longo do dia</div>
        ${renderGraficoTensaoPotencia(curvaDia, "grafico-overview-potencia", false)}
      </div>
    </div>
  `;
}

function renderGraficoTensaoPotencia(curvaDia, id, mostrarTensao = true) {
  if (!curvaDia || curvaDia.length === 0) {
    return `<div class="sem-dados">Ainda não há leituras registradas hoje.</div>`;
  }

  const largura = 600, altura = 180, padding = 28;
  const n = curvaDia.length;
  const xStep = (largura - 2 * padding) / Math.max(n - 1, 1);
  const xAt = (i) => padding + i * xStep;

  const potencias = curvaDia.map((p) => p.potencia);
  const maxPot = Math.max(...potencias, 1);
  const yPot = (v) => altura - padding - (v / maxPot) * (altura - 2 * padding);

  const pontosComTensao = curvaDia
    .map((p, i) => ({ ...p, indice: i }))
    .filter((p) => p.tensao !== null);

  let pathTensao = "";
  let minTensao = 0, maxTensao = 0;
  if (mostrarTensao && pontosComTensao.length > 0) {
    const tensoes = pontosComTensao.map((p) => p.tensao);
    minTensao = Math.min(...tensoes) - 5;
    maxTensao = Math.max(...tensoes) + 5;
    const yTensao = (v) => altura - padding - ((v - minTensao) / (maxTensao - minTensao || 1)) * (altura - 2 * padding);
    pathTensao = pontosComTensao
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.indice).toFixed(1)} ${yTensao(p.tensao).toFixed(1)}`)
      .join(" ");
  }

  const pathPotencia = curvaDia
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yPot(p.potencia).toFixed(1)}`)
    .join(" ");

  const primeiraHora = curvaDia[0].hora;
  const ultimaHora = curvaDia[n - 1].hora;

  return `
    <div style="position: relative;" id="${id}-wrap">
      <svg id="${id}" viewBox="0 0 ${largura} ${altura}" style="width: 100%; height: auto; background: #0f0f1a; border-radius: 8px; touch-action: pan-y;">
        <path d="${pathPotencia}" fill="none" stroke="#e63946" stroke-width="2" />
        ${pathTensao ? `<path d="${pathTensao}" fill="none" stroke="#4ade80" stroke-width="2" />` : ""}
      </svg>
      <div id="${id}-linha" style="position: absolute; top: 0; bottom: 0; width: 1px; background: #555; display: none; pointer-events: none;"></div>
      <div id="${id}-tooltip" style="position: absolute; display: none; background: #000; border: 1px solid #333; padding: 4px 8px; border-radius: 6px; font-size: 11px; pointer-events: none; white-space: nowrap; z-index: 10;"></div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 2px;">
      <span>${primeiraHora}</span>
      <span>${ultimaHora}</span>
    </div>
    <div style="display: flex; gap: 16px; font-size: 11px; color: #9999aa; margin-top: 8px;">
      <span>🔴 Potência (W) — máx. ${maxPot.toFixed(0)}</span>
      ${mostrarTensao && pontosComTensao.length > 0 ? `<span>🟢 Tensão CA (V) — faixa ${(minTensao + 5).toFixed(0)}-${(maxTensao - 5).toFixed(0)}</span>` : ""}
    </div>
  `;
}

// --- Liga os eventos de mouse/toque num gráfico, mostrando o valor do ponto mais próximo ---
function ativarTooltipGrafico(id, curvaDia, mostrarTensao) {
  const svg = document.getElementById(id);
  const tooltip = document.getElementById(`${id}-tooltip`);
  const linha = document.getElementById(`${id}-linha`);
  const wrap = document.getElementById(`${id}-wrap`);
  if (!svg || !tooltip || !wrap || !curvaDia || curvaDia.length === 0) return;

  const largura = 600, padding = 28;
  const n = curvaDia.length;
  const xStep = (largura - 2 * padding) / Math.max(n - 1, 1);

  function mostrarNoPonto(clientX, clientY) {
    const rectSvg = svg.getBoundingClientRect();
    const rectWrap = wrap.getBoundingClientRect();
    const xRelativo = clientX - rectSvg.left;
    const xSvg = (xRelativo / rectSvg.width) * largura;
    let indice = Math.round((xSvg - padding) / xStep);
    indice = Math.max(0, Math.min(n - 1, indice));

    const ponto = curvaDia[indice];
    let texto = `${ponto.hora} — ${ponto.potencia} W`;
    if (mostrarTensao && ponto.tensao !== null) texto += ` / ${ponto.tensao} V`;

    tooltip.textContent = texto;
    tooltip.style.display = "block";

    const xPixelNaTela = rectSvg.left - rectWrap.left + (padding + indice * xStep) * (rectSvg.width / largura);
    let esquerda = xPixelNaTela + 8;
    if (esquerda + 120 > rectWrap.width) esquerda = xPixelNaTela - 120;
    tooltip.style.left = `${esquerda}px`;
    tooltip.style.top = `4px`;

    linha.style.left = `${xPixelNaTela}px`;
    linha.style.display = "block";
  }

  function esconder() {
    tooltip.style.display = "none";
    linha.style.display = "none";
  }

  svg.addEventListener("mousemove", (e) => mostrarNoPonto(e.clientX, e.clientY));
  svg.addEventListener("mouseleave", esconder);
  svg.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    mostrarNoPonto(t.clientX, t.clientY);
  }, { passive: true });
  svg.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    mostrarNoPonto(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  svg.addEventListener("touchend", esconder);
}

function secaoTempoReal(tempoReal, curvaDia) {
  const graficoHtml = `
    <div class="inversor-box">
      <div class="inversor-titulo">Tensão da rede (CA) x Potência do inversor — hoje</div>
      ${renderGraficoTensaoPotencia(curvaDia, "grafico-tensao-potencia", true)}
    </div>
  `;

  if (!tempoReal || !Array.isArray(tempoReal)) {
    return `<div class="card"><h2>Dados elétricos em tempo real</h2>${graficoHtml}<div class="sem-dados">Sem dados instantâneos disponíveis.</div></div>`;
  }

  const boxes = tempoReal.map((inv) => `
    <div class="inversor-box">
      <div class="inversor-titulo">Inversor ${inv.sn}</div>
      <div class="campo-grid">
        <div class="campo"><div class="campo-label">Potência ativa</div><div class="campo-valor">${inv.pac ?? "-"} W</div></div>
        <div class="campo"><div class="campo-label">Potência reativa</div><div class="campo-valor">${inv.prc ?? "-"} W</div></div>
        <div class="campo"><div class="campo-label">Fator de potência</div><div class="campo-valor">${escala(inv.pf, 100, 2)}</div></div>
        <div class="campo"><div class="campo-label">Frequência</div><div class="campo-valor">${escala(inv.fac, 100, 2)} Hz</div></div>
        <div class="campo"><div class="campo-label">Geração hoje</div><div class="campo-valor">${escala(inv.etd, 10)} kWh</div></div>
        <div class="campo"><div class="campo-label">Geração total</div><div class="campo-valor">${escala(inv.eto, 10)} kWh</div></div>
        <div class="campo"><div class="campo-label">Tensão barramento</div><div class="campo-valor">${escala(inv.bv, 10)} V</div></div>
        <div class="campo"><div class="campo-label">Temp. dissipador</div><div class="campo-valor">${escala(inv.cf, 10)} °C</div></div>
        <div class="campo"><div class="campo-label">MPPT 1 (V / A)</div><div class="campo-valor">${escala(inv.v1, 10)} V / ${escala(inv.i1, 100, 2)} A</div></div>
        <div class="campo"><div class="campo-label">MPPT 2 (V / A)</div><div class="campo-valor">${escala(inv.v2, 10)} V / ${escala(inv.i2, 100, 2)} A</div></div>
        <div class="campo"><div class="campo-label">MPPT 3 (V / A)</div><div class="campo-valor">${escala(inv.v3, 10)} V / ${escala(inv.i3, 100, 2)} A</div></div>
        <div class="campo"><div class="campo-label">AC Fase 1 (V / A)</div><div class="campo-valor">${escala(inv.va1, 10)} V / ${escala(inv.ia1, 10)} A</div></div>
        <div class="campo"><div class="campo-label">AC Fase 2 (V / A)</div><div class="campo-valor">${escala(inv.va2, 10)} V / ${escala(inv.ia2, 10)} A</div></div>
        <div class="campo"><div class="campo-label">AC Fase 3 (V / A)</div><div class="campo-valor">${escala(inv.va3, 10)} V / ${escala(inv.ia3, 10)} A</div></div>
        <div class="campo"><div class="campo-label">Horas conectado</div><div class="campo-valor">${inv.hto ?? "-"} h</div></div>
      </div>
      <div class="atualizado">Leitura: ${inv.tim ?? "-"}</div>
    </div>
  `).join("");

  return `<div class="card"><h2>Dados elétricos em tempo real</h2>${graficoHtml}${boxes}</div>`;
}

function secaoCiclo() {
  const hoje = new Date().toISOString().slice(0, 10);
  return `
    <div class="card">
      <h2>Consultar geração por período</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
        <div style="flex: 1; min-width: 130px;">
          <div class="metric-label">De</div>
          <input type="date" id="data-inicio" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #333; background: #14141f; color: #fff;" />
        </div>
        <div style="flex: 1; min-width: 130px;">
          <div class="metric-label">Até</div>
          <input type="date" id="data-fim" value="${hoje}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #333; background: #14141f; color: #fff;" />
        </div>
      </div>
      <button onclick="consultarCiclo()" style="width: 100%; padding: 12px; border-radius: 8px; border: none; background: #e63946; color: #fff; font-weight: 600; cursor: pointer;">Calcular geração no período</button>
      <div id="resultado-ciclo" style="margin-top: 16px;"></div>
    </div>
  `;
}

function renderGraficoBarra(detalheDiario) {
  if (!detalheDiario || detalheDiario.length === 0) return "";

  const valorMax = Math.max(...detalheDiario.map((d) => d.valor), 1);

  const barras = detalheDiario.map((d) => {
    const alturaPercentual = Math.max((d.valor / valorMax) * 100, 2);
    const cor = d.estimado ? "#f59e0b" : "#e63946";
    const diaCurto = d.data.slice(8, 10); // só o número do dia
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 18px;" title="${d.data}: ${d.valor} kWh${d.estimado ? " (estimado)" : ""}">
        <div style="width: 100%; height: 90px; display: flex; align-items: flex-end;">
          <div style="width: 100%; height: ${alturaPercentual}%; background: ${cor}; border-radius: 3px 3px 0 0;"></div>
        </div>
        <div style="font-size: 9px; color: #666;">${diaCurto}</div>
      </div>
    `;
  }).join("");

  return `
    <div style="margin-top: 16px;">
      <div style="display: flex; align-items: flex-end; gap: 3px; overflow-x: auto; padding-bottom: 4px;">
        ${barras}
      </div>
      <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 11px; color: #9999aa;">
        <span>🔴 registrado</span>
        <span>🟡 estimado (falha de comunicação)</span>
      </div>
    </div>
  `;
}

async function consultarCiclo() {
  const codigo = pegarCodigoDaUrl();
  const inicio = document.getElementById("data-inicio").value;
  const fim = document.getElementById("data-fim").value;
  const resultadoDiv = document.getElementById("resultado-ciclo");

  if (!inicio || !fim) {
    resultadoDiv.innerHTML = `<div class="sem-dados">Escolha as duas datas.</div>`;
    return;
  }

  resultadoDiv.innerHTML = `<div class="sem-dados">Calculando...</div>`;

  try {
    const resp = await fetch(`${BACKEND_URL}/api/ciclo?codigo=${codigo}&inicio=${inicio}&fim=${fim}`);
    const dados = await resp.json();

    if (dados.erro) {
      resultadoDiv.innerHTML = `<div class="erro-msg">${dados.erro}</div>`;
      return;
    }

    resultadoDiv.innerHTML = `
      <div class="metric-value">${dados.totalEstimado} <span class="metric-unit">kWh (estimativa real)</span></div>
      ${dados.totalEstimado !== dados.totalRegistrado
        ? `<div class="sem-dados" style="margin-top: 4px;">Valor registrado pela Solplanet: ${dados.totalRegistrado} kWh</div>`
        : ""
      }
      <div class="atualizado" style="margin-top: 10px; line-height: 1.5;">${dados.aviso}</div>
      ${renderGraficoBarra(dados.detalheDiario)}
    `;
  } catch (err) {
    resultadoDiv.innerHTML = `<div class="erro-msg">Erro ao consultar. Verifique sua conexão.</div>`;
  }
}

function secaoAnaliseConta() {
  const hoje = new Date().toISOString().slice(0, 10);
  const estiloInput = "width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #333; background: #14141f; color: #fff;";
  return `
    <div class="card">
      <h2>Análise de conta de energia</h2>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
        <div style="flex: 1; min-width: 130px;">
          <div class="metric-label">De</div>
          <input type="date" id="conta-data-inicio" style="${estiloInput}" />
        </div>
        <div style="flex: 1; min-width: 130px;">
          <div class="metric-label">Até</div>
          <input type="date" id="conta-data-fim" value="${hoje}" style="${estiloInput}" />
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <div class="metric-label">Excedente registrado na conta (kWh)</div>
        <input type="number" step="0.01" id="conta-excedente" placeholder="Ex: 120" style="${estiloInput}" />
      </div>
      <div style="margin-bottom: 12px;">
        <div class="metric-label">Consumo registrado na conta (kWh)</div>
        <input type="number" step="0.01" id="conta-consumo" placeholder="Ex: 80" style="${estiloInput}" />
      </div>
      <div style="margin-bottom: 12px;">
        <div class="metric-label">Valor atual do kWh (R$)</div>
        <input type="number" step="0.01" id="conta-tarifa" placeholder="Ex: 0.85" style="${estiloInput}" />
      </div>
      <button onclick="analisarConta()" style="width: 100%; padding: 12px; border-radius: 8px; border: none; background: #e63946; color: #fff; font-weight: 600; cursor: pointer;">Analisar</button>
      <div id="resultado-conta" style="margin-top: 16px;"></div>
    </div>
  `;
}

async function analisarConta() {
  const codigo = pegarCodigoDaUrl();
  const inicio = document.getElementById("conta-data-inicio").value;
  const fim = document.getElementById("conta-data-fim").value;
  const excedente = document.getElementById("conta-excedente").value;
  const consumo = document.getElementById("conta-consumo").value;
  const tarifa = document.getElementById("conta-tarifa").value;
  const resultadoDiv = document.getElementById("resultado-conta");

  if (!inicio || !fim || !excedente || !consumo || !tarifa) {
    resultadoDiv.innerHTML = `<div class="sem-dados">Preencha todos os campos.</div>`;
    return;
  }

  resultadoDiv.innerHTML = `<div class="sem-dados">Calculando...</div>`;

  try {
    const url = `${BACKEND_URL}/api/analise-conta?codigo=${codigo}&inicio=${inicio}&fim=${fim}&excedente=${excedente}&consumo=${consumo}&tarifa=${tarifa}`;
    const resp = await fetch(url);
    const dados = await resp.json();

    if (dados.erro) {
      resultadoDiv.innerHTML = `<div class="erro-msg">${dados.erro}</div>`;
      return;
    }

    resultadoDiv.innerHTML = `
      <div class="campo-grid" style="margin-bottom: 14px;">
        <div class="campo"><div class="campo-label">Geração real</div><div class="campo-valor">${dados.geracaoReal} kWh</div></div>
        <div class="campo"><div class="campo-label">Excedente na conta</div><div class="campo-valor">${dados.excedenteConta} kWh</div></div>
        <div class="campo"><div class="campo-label">Autoconsumo instantâneo</div><div class="campo-valor">${dados.autoconsumoInstantaneo} kWh</div></div>
        <div class="campo"><div class="campo-label">Consumo na conta</div><div class="campo-valor">${dados.consumoConta} kWh</div></div>
        <div class="campo"><div class="campo-label">Consumo real total</div><div class="campo-valor">${dados.consumoRealTotal} kWh</div></div>
        <div class="campo"><div class="campo-label">Pagaria sem solar</div><div class="campo-valor">R$ ${dados.valorSemSolar}</div></div>
      </div>
      <div class="atualizado" style="line-height: 1.5;">${dados.texto}</div>
    `;
  } catch (err) {
    resultadoDiv.innerHTML = `<div class="erro-msg">Erro ao consultar. Verifique sua conexão.</div>`;
  }
}

function secaoStatus(dicas) {
  if (!dicas || dicas.length === 0) {
    return `<div class="card"><h2>Status</h2><div class="sem-dados">Tudo certo por aqui. ✅</div></div>`;
  }
  const icones = { erro: "🔴", aviso: "🟡", ok: "✅" };
  const itens = dicas.map((d) => `
    <div class="lista-item">
      ${icones[d.tipo] ?? "🟡"} ${d.mensagem}
    </div>
  `).join("");
  return `<div class="card"><h2>Status</h2>${itens}</div>`;
}

async function carregarDados() {
  const conteudo = document.getElementById("conteudo");
  const codigo = pegarCodigoDaUrl();

  if (!codigo) {
    conteudo.innerHTML = `<div class="card erro-msg">Link inválido.<br>Peça o link correto pra Electrize.</div>`;
    return;
  }

  try {
    const resp = await fetch(`${BACKEND_URL}/api/usina?codigo=${codigo}`);
    const dados = await resp.json();

    if (dados.erro) {
      conteudo.innerHTML = `<div class="card erro-msg">${dados.erro}</div>`;
      return;
    }

    conteudo.innerHTML = `
      <div class="card"><h1>${dados.nomeUsina}</h1></div>
      ${secaoOverview(dados.overview, dados.curvaDia)}
      ${secaoCiclo()}
      ${secaoAnaliseConta()}
      ${secaoTempoReal(dados.tempoReal, dados.curvaDia)}
    `;

    ativarTooltipGrafico("grafico-overview-potencia", dados.curvaDia, false);
    ativarTooltipGrafico("grafico-tensao-potencia", dados.curvaDia, true);
  } catch (err) {
    console.error(err);
    conteudo.innerHTML = `<div class="card erro-msg">Não foi possível carregar os dados.<br>Verifique sua conexão.</div>`;
  }
}

carregarDados();
