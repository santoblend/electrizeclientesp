const BACKEND_URL = "https://electrizemonitorsp.onrender.com";

let todosOsClientes = [];
let abaAtiva = "online";

async function entrar() {
  const senha = document.getElementById("senha").value;
  const erroDiv = document.getElementById("erro");

  if (!senha) {
    erroDiv.textContent = "Digite a senha.";
    return;
  }

  erroDiv.textContent = "Carregando...";

  try {
    const resp = await fetch(`${BACKEND_URL}/api/admin/clientes`, {
      headers: { "x-admin-password": senha },
    });

    if (resp.status === 401) {
      erroDiv.textContent = "Senha incorreta.";
      return;
    }

    const dados = await resp.json();
    todosOsClientes = dados.clientes;

    sessionStorage.setItem("adminSenha", senha);

    document.getElementById("login-card").style.display = "none";
    document.getElementById("lista").style.display = "block";

    montarDonutETabs();
    selecionarAba("online");
  } catch (err) {
    erroDiv.textContent = "Erro ao conectar. Verifique se o backend está rodando.";
  }
}

// --- Usa a categoria já classificada pelo backend ---
function categoriaDoCliente(cliente) {
  return cliente.situacao || "offline";
}

function montarDonutETabs() {
  const online = todosOsClientes.filter((c) => categoriaDoCliente(c) === "online").length;
  const atencao = todosOsClientes.filter((c) => categoriaDoCliente(c) === "atencao").length;
  const erro = todosOsClientes.filter((c) => categoriaDoCliente(c) === "erro").length;
  const offline = todosOsClientes.filter((c) => categoriaDoCliente(c) === "offline").length;
  const total = todosOsClientes.length || 1;

  const degOnline = (online / total) * 360;
  const degAtencao = (atencao / total) * 360;
  const degErro = (erro / total) * 360;

  const donut = document.getElementById("donut");
  donut.style.background = `conic-gradient(
    #4ade80 0deg ${degOnline}deg,
    #fb923c ${degOnline}deg ${degOnline + degAtencao}deg,
    #f59e0b ${degOnline + degAtencao}deg ${degOnline + degAtencao + degErro}deg,
    #ff6b6b ${degOnline + degAtencao + degErro}deg 360deg
  )`;

  document.getElementById("donut-total").textContent = todosOsClientes.length;
  document.getElementById("cont-online").textContent = online;
  document.getElementById("cont-atencao").textContent = atencao;
  document.getElementById("cont-erro").textContent = erro;
  document.getElementById("cont-offline").textContent = offline;
}

function selecionarAba(aba) {
  abaAtiva = aba;
  ["online", "atencao", "erro", "offline"].forEach((a) => {
    document.getElementById(`aba-${a}`).classList.toggle("ativa", a === aba);
  });
  document.getElementById("busca").value = "";
  filtrarLista();
}

function renderizarLista(clientes) {
  const container = document.getElementById("lista-clientes");

  if (clientes.length === 0) {
    container.innerHTML = `<div style="color: #666; font-size: 13px; padding: 12px 0;">Nenhuma usina nessa categoria.</div>`;
    return;
  }

  container.innerHTML = clientes
    .map((c) => `
      <a class="linha-cliente" href="index.html?c=${c.codigo}" target="_blank">
        <div>
          <div class="nome-cliente">${c.nomeCliente}</div>
        </div>
        <div style="font-size: 12px; color: #666;">${c.etoday ?? "-"} kWh hoje</div>
      </a>
    `)
    .join("");
}

function filtrarLista() {
  const termo = document.getElementById("busca").value.toLowerCase();

  const daCategoria = todosOsClientes.filter((c) => categoriaDoCliente(c) === abaAtiva);
  const filtrados = termo
    ? daCategoria.filter((c) => c.nomeCliente.toLowerCase().includes(termo))
    : daCategoria;

  renderizarLista(filtrados);
}

// Se já tiver senha salva nessa sessão do navegador, entra direto
const senhaSalva = sessionStorage.getItem("adminSenha");
if (senhaSalva) {
  document.getElementById("senha").value = senhaSalva;
  entrar();
}
