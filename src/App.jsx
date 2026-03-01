import { useEffect, useState } from "react";
import { 
  collection, getDocs, addDoc, deleteDoc, updateDoc, 
  doc, query, where, setDoc, getDoc, writeBatch, serverTimestamp 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut 
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "./firebase";

export default function App() {
  // ========== ESTADOS DE AUTENTICAÇÃO ==========
  const [user, setUser] = useState(null);
  const [authTab, setAuthTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ========== ESTADOS DE DADOS PRINCIPAIS ==========
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [profile, setProfile] = useState(null);

  // ========== ESTADOS DE INTERFACE E CALENDÁRIO ==========
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // ========== ESTADOS DE MODAL E EDIÇÃO ==========
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClientHistoryModal, setShowClientHistoryModal] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState(null);
  const [editAppId, setEditAppId] = useState(null);
  const [selCliente, setSelCliente] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selServico, setSelServico] = useState("");
  const [selHora, setSelHora] = useState("");
  const [editId, setEditId] = useState(null);
  const [selectedAppForPayment, setSelectedAppForPayment] = useState(null);

  // ========== ESTADOS DE FORMULÁRIOS ==========
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descFin, setDescFin] = useState("");
  const [valorFin, setValorFin] = useState("");
  const [tipoFin, setTipoFin] = useState("receita");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [dataManualFin, setDataManualFin] = useState(new Date().toISOString().split("T")[0]);
  const [subTipoCartao, setSubTipoCartao] = useState("debito");
  const [descServico, setDescServico] = useState("");
  const [tempoHoras, setTempoHoras] = useState(0);
  const [tempoMinutos, setTempoMinutos] = useState(30);

  // ========== ESTADOS DO PERFIL ==========
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [telefoneProfissional, setTelefoneProfissional] = useState("");
  const [horarioAbertura, setHorarioAbertura] = useState("09:00");
  const [horarioFechamento, setHorarioFechamento] = useState("19:00");
  const [fidelidadeLimit, setFidelidadeLimit] = useState(10);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [gradeHorarios, setGradeHorarios] = useState({
    0: { aberta: false, tipo: "janela" },
    1: { aberta: false, tipo: "janela" },
    2: { aberta: true, tipo: "janela" },
    3: { aberta: true, tipo: "janela" },
    4: { aberta: true, tipo: "janela" },
    5: { aberta: true, tipo: "janela" },
    6: { aberta: true, tipo: "fixo", horas: [7, 9] }
  });

  // ========== ESTADOS CSV E ESTOQUE ==========
  const [importingCSV, setImportingCSV] = useState(false);
  const [nomeProduto, setNomeProduto] = useState("");
  const [qtdProduto, setQtdProduto] = useState("");
  const [alerta, setAlerta] = useState("");
  const [editProductId, setEditProductId] = useState(null);

  // ========== SISTEMA DE TEMAS ==========
  const [primaryColor, setPrimaryColor] = useState("#d81b60");

  // ========== 🤖 ESTADOS DA IA ASSISTENTE ==========
  const [showAI, setShowAI] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("Olá! Sou sua Gerente Virtual. Pergunte sobre horários, clientes, financeiro ou estoque. ✨");
  const [aiChatHistory, setAiChatHistory] = useState([]);
  const [aiActionData, setAiActionData] = useState(null);

  // ========== TEMA MODERNO (DINÂMICO COM CORES) ==========
  const modernTheme = {
    primary: primaryColor,
    primaryLight: primaryColor + "20",
    primaryDark: primaryColor + "dd",
    background: "#f8f9fa",
    card: "#ffffff",
    text: "#2d3436",
    textLight: "#636e72",
    textMuted: "#a0a0a0",
    shadow: "0 4px 15px rgba(0,0,0,0.08)",
    shadowHeavy: "0 8px 25px rgba(0,0,0,0.12)",
    radius: "12px",
    radiusSmall: "8px",
    radiusTiny: "5px",
    success: "#4caf50",
    warning: "#ff9800",
    danger: "#f44336",
    info: "#2196f3"
  };

  // ========== MONITORAMENTO DE AUTENTICAÇÃO ==========
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        loadData(loggedUser.uid);
        loadProfile(loggedUser.uid);
      }
    });
    return unsub;
  }, []);

  // ========== FUNÇÃO DE AUTENTICAÇÃO ==========
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authTab === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail("");
      setPassword("");
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  // ========== CARREGAR DADOS (FIRESTORE) ==========
  async function loadData(uid) {
    try {
      if (!uid) return;

      const qC = await getDocs(query(collection(db, "clients"), where("tenantId", "==", uid)));
      setClients(qC.docs.map(d => ({ id: d.id, ...d.data() })));

      const qS = await getDocs(query(collection(db, "services"), where("tenantId", "==", uid)));
      setServices(qS.docs.map(d => ({ id: d.id, ...d.data() })));

      const qA = await getDocs(query(collection(db, "appointments"), where("tenantId", "==", uid)));
      setAppointments(qA.docs.map(d => ({ id: d.id, ...d.data() })));

      const qT = await getDocs(query(collection(db, "transactions"), where("tenantId", "==", uid)));
      setTransactions(qT.docs.map(d => ({ id: d.id, ...d.data() })));

      const qI = await getDocs(query(collection(db, "inventory"), where("tenantId", "==", uid)));
      setInventory(qI.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { 
      console.error("Erro ao carregar dados:", error); 
    }
  }

  // ========== CARREGAR PERFIL ==========
  async function loadProfile(uid) {
    try {
      if (!uid) return;
      const docRef = doc(db, "profiles", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({ id: uid, ...data });
        setNomeEmpresa(data.nomeEmpresa || "");
        setLogoUrl(data.logoUrl || "");
        setTelefoneProfissional(data.telefoneProfissional || "");
        setHorarioAbertura(data.horarioAbertura || "09:00");
        setHorarioFechamento(data.horarioFechamento || "19:00");
        setFidelidadeLimit(data.fidelidadeLimit || 10);
        setPrimaryColor(data.primaryColor || "#d81b60");
        setGradeHorarios(data.gradeHorarios || { 
          0: { aberta: false }, 1: { aberta: false }, 2: { aberta: true }, 
          3: { aberta: true }, 4: { aberta: true }, 5: { aberta: true }, 
          6: { aberta: true, tipo: "fixo", horas: [7, 9] } 
        });
      }
    } catch (error) { 
      console.error("Erro ao carregar perfil:", error); 
    }
  }

  // ========== UPLOAD DE LOGO ==========
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `logos/${user.uid}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setLogoUrl(url);
      alert("✅ Imagem carregada! Clique em 'Salvar Alterações' para confirmar.");
    } catch (error) {
      alert("❌ Erro ao carregar imagem: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // ========== IMPORTAÇÃO CSV ==========
  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setImportingCSV(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let content = event.target.result;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

        const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
                             .map(l => l.trim()).filter(l => l.length > 0);
        
        let totalCount = 0;
        let batch = writeBatch(db);
        let batchCount = 0;

        for (let i = 1; i < lines.length; i++) {
          try {
            const parts = lines[i].split(/[;,]/).map(item => item?.trim());

            if (parts.length > 0) {
              const nomeCompleto = [parts[0], parts[1], parts[2]]
                .filter(Boolean)
                .join(" ");

              let telefoneFinal = parts[3] || parts[4] || "";
              telefoneFinal = telefoneFinal.replace(/[^\d+() -]/g, "");

              if (nomeCompleto && nomeCompleto !== "First Name Middle Name Last Name") {
                const newRef = doc(collection(db, "clients"));
                batch.set(newRef, {
                  nome: nomeCompleto,
                  telefone: telefoneFinal,
                  tenantId: user.uid,
                  createdAt: serverTimestamp()
                });
                
                batchCount++;
                totalCount++;

                if (batchCount === 500) {
                  await batch.commit();
                  batch = writeBatch(db);
                  batchCount = 0;
                  console.log(`✅ ${totalCount} contatos processados...`);
                }
              }
            }
          } catch (err) {
            console.error(`Erro na linha ${i + 1}:`, err);
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        loadData(user.uid);
        alert(`✅ Sucesso! ${totalCount} contatos importados com nomes completos.`);
      } catch (error) {
        alert("❌ Erro ao processar arquivo: " + error.message);
      } finally {
        setImportingCSV(false);
        e.target.value = ""; 
      }
    };

    reader.readAsText(file, "UTF-8");
  };

  // ========== SALVAR PERFIL ==========
  const handleSaveProfile = async () => {
    try {
      if (!user) return;

      const docRef = doc(db, "profiles", user.uid);
      await setDoc(docRef, {
        nomeEmpresa,
        logoUrl,
        telefoneProfissional,
        horarioAbertura,
        horarioFechamento,
        fidelidadeLimit,
        gradeHorarios,
        primaryColor,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setEditingProfile(false);
      loadProfile(user.uid);
      alert("✅ Perfil salvo com sucesso!");
    } catch (error) {
      alert("❌ Erro ao salvar perfil: " + error.message);
    }
  };

  // ========== LÓGICA DE BLOQUEIO DE HORÁRIOS ==========
  const getAppDoHorario = (hora) => {
    const dSel = new Date(selectedDate);
    return appointments.find(a => {
      const inicio = new Date(a.dataHora);
      const serv = services.find(s => s.id === a.serviceId);
      const dMin = serv ? Number(serv.duracao) : 60;
      const mesmaData = inicio.getDate() === dSel.getDate() && inicio.getMonth() === dSel.getMonth() && inicio.getFullYear() === dSel.getFullYear();
      if (!mesmaData) return false;
      const hInicio = inicio.getHours();
      const hFim = hInicio + (inicio.getMinutes() + dMin) / 60;
      return hora >= hInicio && hora < Math.ceil(hFim);
    });
  };

  // ========== GRÁFICOS DE FATURAMENTO ==========
  const getChartData = () => {
    const dinheiro = transactions.filter(t => t.formaPagamento === "dinheiro" && t.tipo === "receita").reduce((acc, t) => acc + t.valor, 0);
    const cartao = transactions.filter(t => t.formaPagamento === "cartao" && t.tipo === "receita").reduce((acc, t) => acc + t.valor, 0);
    const pix = transactions.filter(t => t.formaPagamento === "pix" && t.tipo === "receita").reduce((acc, t) => acc + t.valor, 0);
    const total = dinheiro + cartao + pix;

    return {
      dinheiro: total > 0 ? ((dinheiro / total) * 100).toFixed(1) : 0,
      cartao: total > 0 ? ((cartao / total) * 100).toFixed(1) : 0,
      pix: total > 0 ? ((pix / total) * 100).toFixed(1) : 0,
      total: total.toFixed(2),
      valores: { dinheiro, cartao, pix }
    };
  };

  // ========== HISTÓRICO DA CLIENTE ==========
  const getClientHistory = (clientId) => {
    const clientApps = appointments.filter(a => a.clientId === clientId);
    const appIds = clientApps.map(a => a.id);
    const clientTransactions = transactions.filter(t => appIds.includes(t.appointmentId));
    const totalGasto = clientTransactions.reduce((acc, t) => acc + (t.tipo === "receita" ? t.valor : 0), 0);
    
    return {
      apps: clientApps.sort((a, b) => b.dataHora.localeCompare(a.dataHora)),
      totalGasto,
      count: clientApps.length
    };
  };

  // ========== CONTAGEM DE FIDELIDADE ==========
  const getClientFidelity = (clientId) => {
    const paidApps = appointments.filter(a => a.clientId === clientId && a.status === "pago");
    const count = paidApps.length;
    const achieved = count >= fidelidadeLimit;
    return { count, achieved, limit: fidelidadeLimit };
  };

  // ========== CONTROLE DE ESTOQUE ==========
  const handleSaveProduct = async () => {
    if (!nomeProduto.trim() || !qtdProduto || !alerta) return alert("Preencha todos os campos");
    try {
      if (editProductId) {
        await updateDoc(doc(db, "inventory", editProductId), {
          nome: nomeProduto,
          quantidade: Number(qtdProduto),
          alertaCritico: Number(alerta),
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, "inventory"), {
          nome: nomeProduto,
          quantidade: Number(qtdProduto),
          alertaCritico: Number(alerta),
          tenantId: user.uid,
          createdAt: new Date().toISOString()
        });
      }
      setNomeProduto("");
      setQtdProduto("");
      setAlerta("");
      setEditProductId(null);
      loadData(user.uid);
    } catch (error) {
      alert("❌ Erro: " + error.message);
    }
  };

  // ========== MODAL DE PAGAMENTO ==========
  const handlePaymentClick = (app) => {
    setSelectedAppForPayment(app);
    setFormaPagamento("pix");
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedAppForPayment) return;

    const serv = services.find(s => s.id === selectedAppForPayment.serviceId);
    const cli = clients.find(c => c.id === selectedAppForPayment.clientId);
    
    try {
      await addDoc(collection(db, "transactions"), {
        descricao: `Atendimento: ${cli?.nome} (${serv?.nome})`,
        valor: Number(serv?.preco || 0),
        tipo: "receita",
        data: new Date().toISOString(),
        tenantId: user.uid,
        appointmentId: selectedAppForPayment.id,
        formaPagamento: formaPagamento
      });
      await updateDoc(doc(db, "appointments", selectedAppForPayment.id), { status: "pago" });
      loadData(user.uid);
      setShowPaymentModal(false);
      setSelectedAppForPayment(null);
      alert("✅ Pagamento recebido!");
    } catch (error) {
      alert("❌ Erro ao confirmar pagamento: " + error.message);
    }
  };

  // ========== LEMBRETE WHATSAPP ==========
  const sendWhatsAppReminder = (app) => {
    const cli = clients.find(c => c.id === app.clientId);
    const serv = services.find(s => s.id === app.serviceId);
    
    if (!cli || !cli.telefone) {
      return alert("❌ Esta cliente não possui telefone cadastrado!");
    }

    const dataFmt = new Date(app.dataHora).toLocaleDateString("pt-BR");
    const horaFmt = String(new Date(app.dataHora).getHours()).padStart(2, "0");
    const minFmt = String(new Date(app.dataHora).getMinutes()).padStart(2, "0");
    const nomeS = nomeEmpresa || "Pragendar R$";

    const mensagem = `Olá ${cli.nome}! ✨ Aqui é do ${nomeS}. Passando para confirmar seu horário de *${serv?.nome || "procedimento"}* no dia *${dataFmt}* às *${horaFmt}:${minFmt}h*. Podemos confirmar? 🙏`;

    const foneLimpo = cli.telefone.replace(/\D/g, "");
    const foneFinal = foneLimpo.startsWith("55") ? foneLimpo : `55${foneLimpo}`;
    const link = `https://wa.me/${foneFinal}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(link, "_blank");
  };

  // ========== 🆕 FUNÇÃO: COBRAR NO WHATSAPP (PARA A IA) ==========
  const sendCobrancaWhatsApp = (cliente) => {
    if (!cliente || !cliente.telefone) {
      alert("❌ Cliente não possui telefone cadastrado!");
      return;
    }

    const nomeS = nomeEmpresa || "Pragendar R$";
    const mensagem = `Olá ${cliente.nome}! 👋 Aqui é do ${nomeS}. Há quanto tempo não nos vê? 😊 Saudades! Que tal marcar um horário para você? Temos promoções especiais esperando por você! 💅✨`;

    const foneLimpo = cliente.telefone.replace(/\D/g, "");
    const foneFinal = foneLimpo.startsWith("55") ? foneLimpo : `55${foneLimpo}`;
    const link = `https://wa.me/${foneFinal}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(link, "_blank");
  };

  // ========== SALVAR TRANSAÇÃO ==========
  const handleSaveTransaction = async () => {
    const d = { 
      descricao: descFin, 
      valor: Number(valorFin), 
      tipo: tipoFin, 
      data: new Date(dataManualFin).toISOString(),
      subTipo: subTipoCartao,
      tenantId: user.uid,
      formaPagamento: formaPagamento
    };
    try {
      if (editId) await updateDoc(doc(db, "transactions", editId), d);
      else await addDoc(collection(db, "transactions"), d);
      setEditId(null); 
      setDescFin(""); 
      setValorFin(""); 
      setFormaPagamento("pix");
      loadData(user.uid);
    } catch (error) {
      alert("�� Erro ao salvar transação: " + error.message);
    }
  };

  // ========== AUXILIARES ==========
  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";
  const getTel = (list, id) => list.find(i => i.id === id)?.telefone || "";

  const deleteWithConfirm = async (col, id, nome, extra = "") => {
    if (window.confirm(`Tem certeza que deseja excluir ${nome} ${extra ? `(${extra})` : ""}?`)) {
      try {
        await deleteDoc(doc(db, col, id));
        loadData(user.uid);
      } catch (error) {
        alert("❌ Erro ao deletar: " + error.message);
      }
    }
  };

  // ========== IMPRESSÃO DE RELATÓRIO ==========
  const printReport = () => {
    const chart = getChartData();
    const dataAtual = new Date().toLocaleDateString("pt-BR");
    const win = window.open("", "relatório");
    const html = `<!DOCTYPE html>
<html>
<head>
<title>Relatório ${nomeEmpresa}</title>
<style>
body { font-family: Arial, sans-serif; padding: 20px; margin: 0; background: white; }
.container { max-width: 900px; margin: 0 auto; }
h1 { text-align: center; color: ${primaryColor}; margin-bottom: 10px; }
.data-relatorio { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
.card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }
.card strong { display: block; color: ${primaryColor}; margin-bottom: 10px; }
.card small { display: block; font-size: 11px; color: #666; margin-top: 5px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th { background: ${primaryColor}; color: white; padding: 12px; text-align: left; font-weight: bold; }
td { border: 1px solid #ddd; padding: 10px; font-size: 12px; }
tr:nth-child(even) { background: #f5f5f5; }
.total-row { font-weight: bold; background: #ffe0ec; }
@media print { body { margin: 0; padding: 0; } .no-print { display: none; } button { display: none; } }
</style>
</head>
<body>
<div class="container">
<h1>${nomeEmpresa || "Pragendar R$"}</h1>
<p class="data-relatorio">Relatório Financeiro de ${dataAtual}</p>
<h2 style="color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 10px;">Resumo Financeiro</h2>
<div class="summary">
<div class="card"><strong>💵 Dinheiro</strong>R$ ${chart.valores.dinheiro.toFixed(2)}<br/><small>${chart.dinheiro}%</small></div>
<div class="card"><strong>💳 Cartão</strong>R$ ${chart.valores.cartao.toFixed(2)}<br/><small>${chart.cartao}%</small></div>
<div class="card"><strong>📲 Pix</strong>R$ ${chart.valores.pix.toFixed(2)}<br/><small>${chart.pix}%</small></div>
</div>
<div style="background: ${primaryColor}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
<h3 style="margin: 0; font-size: 28px;">R$ ${chart.total}</h3>
<small>Total Recebido</small></div>
<h2 style="color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 10px;">Agendamentos Realizados</h2>
<table><thead><tr><th>Data/Hora</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Status</th></tr></thead><tbody>
${appointments.map(a => {
  const serv = services.find(s => s.id === a.serviceId);
  const valor = serv?.preco || 0;
  return `<tr><td>${new Date(a.dataHora).toLocaleDateString("pt-BR")} ${String(new Date(a.dataHora).getHours()).padStart(2, "0")}:${String(new Date(a.dataHora).getMinutes()).padStart(2, "0")}</td><td>${getNome(clients, a.clientId)}</td><td>${getNome(services, a.serviceId)}</td><td>R$ ${valor}</td><td>${a.status === "pago" ? "✅ Pago" : "⏳ Pendente"}</td></tr>`;
}).join("")}
<tr class="total-row"><td colspan="3" style="text-align: right;">TOTAL FATURADO:</td><td colspan="2">R$ ${appointments.filter(a => a.status === "pago").reduce((acc, a) => {
  const serv = services.find(s => s.id === a.serviceId);
  return acc + (serv?.preco || 0);
}, 0).toFixed(2)}</td></tr></tbody></table>
<h2 style="color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 10px; margin-top: 30px;">Resumo de Clientes</h2>
<p style="font-size: 12px; color: #666;">Total de clientes: <strong>${clients.length}</strong> | Total de atendimentos: <strong>${appointments.length}</strong></p>
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 11px;">
<p>Relatório gerado automaticamente pelo Pragendar R$ em ${new Date().toLocaleString("pt-BR")}</p></div></div>
<script>window.print(); window.close();</script></body></html>`;

    win.document.write(html);
    win.document.close();
  };

  // ========== 🤖 FUNÇÃO DA IA ASSISTENTE COM AÇÕES RÁPIDAS ==========
  const askAI = (pergunta) => {
    const p = pergunta.toLowerCase().trim();
    let resposta = "";
    let acoes = null;

    if (p.includes("hoje") && (p.includes("agenda") || p.includes("horário") || p.includes("atendimento"))) {
      const hoje = appointments.filter(a => {
        const dataApp = new Date(a.dataHora);
        const dataHoje = new Date();
        return dataApp.toLocaleDateString() === dataHoje.toLocaleDateString();
      });
      
      if (hoje.length === 0) {
        resposta = "🎉 Sua agenda de hoje está livre! Você tem tempo para descansar ou agendar novas clientes.";
      } else {
        const horarios = hoje.map(a => {
          const cli = clients.find(c => c.id === a.clientId);
          const serv = services.find(s => s.id === a.serviceId);
          const h = new Date(a.dataHora).getHours();
          const m = String(new Date(a.dataHora).getMinutes()).padStart(2, "0");
          return `${h}:${m} - ${cli?.nome} (${serv?.nome})`;
        }).join("\n");
        resposta = `📅 Sua agenda de hoje:\n\n${horarios}\n\nTotal: ${hoje.length} atendimentos`;
      }
    }
    else if (p.includes("financeiro") || p.includes("faturamento") || p.includes("ganhei") || p.includes("receita")) {
      const chart = getChartData();
      resposta = `💰 Resumo Financeiro:\n\nTotal Recebido: R$ ${chart.total}\n\n💵 Dinheiro: R$ ${chart.valores.dinheiro.toFixed(2)} (${chart.dinheiro}%)\n💳 Cartão: R$ ${chart.valores.cartao.toFixed(2)} (${chart.cartao}%)\n📲 Pix: R$ ${chart.valores.pix.toFixed(2)} (${chart.pix}%)`;
    }
    else if (p.includes("fiel") || p.includes("prêmio") || p.includes("fidelidade")) {
      const fiéis = clients.filter(c => getClientFidelity(c.id).achieved);
      if (fiéis.length === 0) {
        resposta = "Nenhuma cliente atingiu o prêmio de fidelidade ainda.";
      } else {
        resposta = `🎁 Clientes que ganharam Prêmio (${fiéis.length}):\n\n${fiéis.map(c => `✨ ${c.nome}`).join("\n")}`;
      }
    }
    else if (p.includes("sumida") || p.includes("ausente") || p.includes("voltou") || p.includes("retomar")) {
      const hoje = new Date();
      const sumidas = clients.filter(c => {
        const history = getClientHistory(c.id);
        if (history.count === 0) return false;
        const ultimaData = new Date(history.apps[0].dataHora);
        const diasPassados = (hoje - ultimaData) / (1000 * 60 * 60 * 24);
        return diasPassados > 30;
      });

      if (sumidas.length === 0) {
        resposta = "🎉 Todas as suas clientes estão engajadas! Nenhuma está sumida há mais de 30 dias.";
      } else {
        resposta = `⚠️ Clientes que não retornam há 30+ dias (${sumidas.length}):\n\n${sumidas.slice(0, 5).map(c => {
          const history = getClientHistory(c.id);
          const ultimaData = new Date(history.apps[0].dataHora);
          const diasPassados = Math.floor((hoje - ultimaData) / (1000 * 60 * 60 * 24));
          return `👤 ${c.nome} - Última vez: ${diasPassados} dias atrás`;
        }).join("\n")}`;
        acoes = { tipo: "sumidas", clientes: sumidas.slice(0, 5) };
      }
    }
    else if (p.includes("quem é") || p.includes("dados de") || p.includes("história de") || p.includes("sobre a")) {
      const nomeBusca = p.replace("quem é", "").replace("dados de", "").replace("história de", "").replace("sobre a", "").replace("sobre o", "").trim();
      const cli = clients.find(c => c.nome.toLowerCase().includes(nomeBusca));
      
      if (!cli) {
        resposta = `Não encontrei nenhuma cliente com o nome "${nomeBusca}". Tente de novo! 🔍`;
      } else {
        const history = getClientHistory(cli.id);
        const fidelity = getClientFidelity(cli.id);
        const ultimaVisita = history.count > 0 ? new Date(history.apps[0].dataHora).toLocaleDateString() : "Nunca";
        
        resposta = `📂 Perfil de ${cli.nome}:\n\n📞 Telefone: ${cli.telefone || "Não informado"}\n💰 Total Gasto: R$ ${history.totalGasto.toFixed(2)}\n📊 Atendimentos: ${history.count}\n🎁 Fidelidade: ${fidelity.count}/${fidelity.limit}\n📅 Última Visita: ${ultimaVisita}`;
        acoes = { tipo: "cliente", cliente: cli };
      }
    }
    else if (p.includes("estoque") || p.includes("produto") || p.includes("crítico")) {
      const criticos = inventory.filter(prod => Number(prod.quantidade) <= Number(prod.alertaCritico));
      if (criticos.length === 0) {
        resposta = "✅ Seu estoque está ótimo! Nenhum produto em nível crítico.";
      } else {
        resposta = `⚠️ Produtos em Nível Crítico (${criticos.length}):\n\n${criticos.map(p => `🔴 ${p.nome}: ${p.quantidade} un. (Alerta: ${p.alertaCritico})`).join("\n")}`;
      }
    }
    else if (p.includes("serviço") || p.includes("procedimento") || p.includes("qual é meu")) {
      if (services.length === 0) {
        resposta = "Você ainda não cadastrou nenhum serviço.";
      } else {
        resposta = `💇 Seus Serviços (${services.length}):\n\n${services.map(s => `🎯 ${s.nome} - R$ ${s.preco.toFixed(2)} (${s.duracao} min)`).join("\n")}`;
      }
    }
    else if (p.includes("quantos clientes") || p.includes("total de clientes")) {
      resposta = `👥 Total de Clientes: ${clients.length}\n\nClientes com pelo menos 1 atendimento: ${clients.filter(c => getClientHistory(c.id).count > 0).length}`;
    }
    else if (p.includes("hoje") && p.includes("faturou")) {
      const hojeTotal = calcTotal(transactions, "hoje");
      const mesTotal = calcTotal(transactions, "mes");
      resposta = `📈 Faturamento:\n\nHoje: R$ ${hojeTotal.toFixed(2)}\nEste Mês: R$ ${mesTotal.toFixed(2)}`;
    }
    else {
      resposta = `Pergunte sobre:\n\n• 📅 "Meus horários hoje"\n• 💰 "Meu financeiro"\n• 👥 "Dados da Maria"\n• 🔄 "Clientes sumidas"\n• 🎁 "Prêmio fidelidade"\n• 📦 "Estoque crítico"\n• 💇 "Meus serviços"\n\nOu seja mais específica! 😊`;
    }

    setAiChatHistory([...aiChatHistory, { pergunta, resposta, acoes, timestamp: new Date() }]);
    setAiActionData(acoes);
    return resposta;
  };

  // ========== RENDERIZAÇÃO CONDICIONAL - TELA DE LOGIN ==========
  if (!user) {
    return (
      <div style={{ 
        padding: "40px 20px", 
        fontFamily: "sans-serif", 
        textAlign: "center", 
        minHeight: "100vh", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "center", 
        alignItems: "center", 
        backgroundColor: modernTheme.background,
        background: `linear-gradient(135deg, ${modernTheme.background} 0%, ${primaryColor}10 100%)`
      }}>
        <h1 style={{ color: primaryColor, marginBottom: "10px", fontSize: "3rem", fontWeight: "800" }}>✨ Pragendar R$</h1>
        <p style={{ color: modernTheme.textMuted, marginBottom: "40px", fontSize: "14px", fontWeight: "500" }}>Sistema Premium de Gestão de Agendamentos</p>
        <div style={{...cardStyle, width: "100%", maxWidth: "380px", boxShadow: modernTheme.shadowHeavy}}>
          <h3 style={{marginTop: 0, color: primaryColor}}>{authTab === "login" ? "🔐 Entrar" : "📝 Criar Conta"}</h3>
          <form onSubmit={handleAuth}>
            <input 
              placeholder="📧 E-mail" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              style={inputStyle} 
              required
            />
            <input 
              placeholder="🔑 Senha" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={inputStyle}
              required
            />
            <button type="submit" style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>
              {authTab === "login" ? "Entrar" : "Cadastrar"}
            </button>
          </form>
          <p onClick={() => setAuthTab(authTab === "login" ? "cadastro" : "login")} style={{ cursor: "pointer", color: primaryColor, marginTop: "15px", fontSize: "14px", fontWeight: "bold" }}>
            {authTab === "login" ? "👤 Novo por aqui? Cadastre-se" : "✅ Já tem conta? Faça Login"}
          </p>
        </div>
      </div>
    );
  }

  // ========== INTERFACE: APP PRINCIPAL ==========
  return (
    <div style={{ backgroundColor: modernTheme.background, minHeight: "100vh", paddingBottom: "100px", fontFamily: "sans-serif" }}>
      
      {/* === HEADER PREMIUM === */}
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "20px 15px", 
        backgroundColor: modernTheme.card, 
        boxShadow: modernTheme.shadow,
        marginBottom: "15px",
        borderBottom: `3px solid ${primaryColor}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", border: `3px solid ${primaryColor}` }} />
          ) : (
            <div style={{ width: "50px", height: "50px", borderRadius: "50%", backgroundColor: primaryColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "24px", fontWeight: "bold" }}>✨</div>
          )}
          <div>
            <h1 style={{ color: modernTheme.text, margin: 0, fontSize: "18px", fontWeight: "800" }}>{nomeEmpresa || "Pragendar R$"}</h1>
            <small style={{ color: modernTheme.textMuted, display: "block", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Painel Administrativo Premium</small>
          </div>
        </div>
        <button 
          onClick={() => signOut(auth)} 
          style={{ 
            padding: "8px 16px", 
            backgroundColor: "transparent", 
            color: modernTheme.danger, 
            border: `2px solid ${modernTheme.danger}`,
            borderRadius: modernTheme.radiusSmall,
            cursor: "pointer", 
            fontSize: "12px", 
            fontWeight: "bold",
            transition: "all 0.3s ease"
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = modernTheme.danger;
            e.target.style.color = "white";
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = "transparent";
            e.target.style.color = modernTheme.danger;
          }}
        >
          Sair
        </button>
      </header>

      {/* === NAVEGAÇÃO ESTILO APP PREMIUM === */}
      <nav style={{ 
        display: "flex", 
        gap: "8px", 
        overflowX: "auto", 
        padding: "15px",
        backgroundColor: "transparent",
        scrollBehavior: "smooth",
        WebkitOverflowScrolling: "touch"
      }}>
        {[
          { id: "agenda", icon: "📅", label: "Agenda" },
          { id: "financeiro", icon: "💰", label: "Caixa" },
          { id: "clientes", icon: "👥", label: "Clientes" },
          { id: "servicos", icon: "💇", label: "Serviços" },
          { id: "estoque", icon: "📦", label: "Estoque" },
          { id: "retornos", icon: "🔄", label: "Retornos" },
          { id: "perfil", icon: "⚙️", label: "Ajustes" }
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: "0 0 auto",
              minWidth: "85px",
              padding: "12px 12px", 
              borderRadius: modernTheme.radius, 
              border: "none",
              backgroundColor: tab === t.id ? primaryColor : modernTheme.card,
              color: tab === t.id ? "#fff" : modernTheme.textLight,
              boxShadow: tab === t.id ? `0 4px 15px ${primaryColor}40` : modernTheme.shadow,
              cursor: "pointer", 
              transition: "all 0.3s ease",
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              gap: "5px",
              fontWeight: tab === t.id ? "700" : "600",
              fontSize: "12px"
            }}
            onMouseOver={(e) => {
              if (tab !== t.id) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = modernTheme.shadowHeavy;
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = tab === t.id ? `0 4px 15px ${primaryColor}40` : modernTheme.shadow;
            }}
          >
            <span style={{ fontSize: "18px" }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ padding: "0 15px" }}>
        {/* === ABA AGENDA === */}
        {tab === "agenda" && (
          <div>
            <div style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <button onClick={() => setViewMonth(v => (v - 1 + 12) % 12)} style={{...btnMini, backgroundColor: primaryColor, color: "#fff"}}>{"<"}</button>
                <strong style={{color: modernTheme.text, fontSize: "16px"}}>{nomeMeses[viewMonth]} {viewYear}</strong>
                <button onClick={() => setViewMonth(v => (v + 1) % 12)} style={{...btnMini, backgroundColor: primaryColor, color: "#fff"}}>{" >"}</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "15px" }}>
                {["D","S","T","Q","Q","S","S"].map(d => <div key={d} style={{textAlign:"center", fontSize:"10px", fontWeight:"bold", padding: "8px 0", color: modernTheme.textLight}}>{d}</div>)}
                {Array(new Date(viewYear, viewMonth, 1).getDay()).fill(null).map((_, i) => <div key={i}></div>)}
                {Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, i) => i + 1).map(dia => (
                  <div key={dia} onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))}
                    style={{ 
                      padding: "10px 5px", textAlign: "center", borderRadius: modernTheme.radiusTiny, cursor: "pointer", 
                      border: `2px solid ${selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? primaryColor : "#eee"}`,
                      backgroundColor: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? primaryColor : modernTheme.card,
                      color: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? "#fff" : modernTheme.text, 
                      fontSize: "12px", fontWeight: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? "bold" : "normal"
                    }}>
                    {dia}
                  </div>
                ))}
              </div>
            </div>

            <div style={{...cardStyle, boxShadow: modernTheme.shadow, marginTop: "15px"}}>
              <h3 style={{borderBottom: `2px solid ${primaryColor}`, paddingBottom: "10px", color: modernTheme.text, margin: "0 0 15px 0"}}>📅 Dia {selectedDate.toLocaleDateString("pt-BR")}</h3>
              {(() => {
                const horaInicio = parseInt(horarioAbertura.split(":")[0]) || 8;
                const horaFim = parseInt(horarioFechamento.split(":")[0]) || 19;
                const totalHoras = horaFim - horaInicio + 1;
                const diaSemana = selectedDate.getDay();
                const configHoje = gradeHorarios[diaSemana];

                if (!configHoje?.aberta) {
                  return <div style={{textAlign: "center", padding: "40px 20px", color: modernTheme.textMuted, backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radius}}>😴 Estamos fechados hoje. Volte em outro dia!</div>;
                }

                return Array.from({ length: totalHoras }, (_, i) => i + horaInicio).map(hora => {
                  if (configHoje.tipo === "fixo" && !configHoje.horas?.includes(hora)) return null;

                  const agora = new Date();
                  const dataComparacao = new Date(selectedDate);
                  dataComparacao.setHours(hora, 0, 0, 0);
                  const ehPassado = dataComparacao < agora;

                  const app = getAppDoHorario(hora);
                  const isStart = app && new Date(app.dataHora).getHours() === hora;

                  return (
                    <div key={hora} style={{ 
                      ...itemStyle, 
                      borderLeft: app?.status === "pago" ? `5px solid ${modernTheme.success}` : (app ? `5px solid ${modernTheme.warning}` : "1px solid #eee"), 
                      backgroundColor: app ? modernTheme.primaryLight : modernTheme.card,
                      borderRadius: modernTheme.radiusTiny,
                      marginBottom: "8px"
                    }}>
                      <div style={{ width: "60px", fontWeight: "bold", color: primaryColor, fontSize: "14px" }}>{String(hora).padStart(2, "0")}:00</div>
                      <div style={{ flex: 1 }}>
                        {app ? (
                          <div onClick={() => {setSelHora(hora); setEditAppId(app.id); setSelCliente(app.clientId); setSelServico(app.serviceId); setClientSearch(getNome(clients, app.clientId)); setShowModal(true);}} style={{cursor:"pointer", opacity: isStart ? 1 : 0.6}}>
                            <strong style={{color: modernTheme.text}}>{getNome(clients, app.clientId)}</strong> {isStart && `- ${getNome(services, app.serviceId)}`}
                          </div>
                        ) : (
                          ehPassado ? 
                          <span style={{color: modernTheme.textMuted, cursor:"not-allowed", fontSize: "12px"}}>Indisponível</span> :
                          <span onClick={() => {setSelHora(hora); setEditAppId(null); setSelCliente(""); setClientSearch(""); setShowModal(true);}} style={{color: modernTheme.success, cursor:"pointer", fontWeight: "bold", fontSize: "12px"}}>+ Disponível</span>
                        )}
                      </div>
                      {isStart && (
                        <div style={{ display: "flex", gap: "3px" }}>
                          <button onClick={() => sendWhatsAppReminder(app)} style={btnWhatsApp}>📱</button>
                          {app.status !== "pago" && <button onClick={() => handlePaymentClick(app)} style={btnPay}>💵</button>}
                          <button onClick={() => deleteWithConfirm("appointments", app.id, getNome(clients, app.clientId))} style={btnDel}>X</button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* === ABA FINANCEIRO === */}
        {tab === "financeiro" && (
          <div>
            {(() => {
              const chart = getChartData();
              return (
                <div style={{...cardStyle, boxShadow: modernTheme.shadow, background: `linear-gradient(135deg, ${modernTheme.card} 0%, ${primaryColor}05 100%)`}}>
                  <h3 style={{color: primaryColor, marginBottom: "20px"}}>📊 Resumo do Mês</h3>
                  <p style={{fontSize:"14px", fontWeight:"bold", marginBottom:"15px", color: modernTheme.text}}>Total Recebido: <span style={{color: primaryColor, fontSize: "18px"}}>R$ {chart.total}</span></p>
                  
                  <div style={{marginBottom:"20px"}}>
                    <div style={{marginBottom:"12px"}}>
                      <small style={{color: modernTheme.textLight, fontWeight: "600"}}>💵 Dinheiro: R$ {chart.valores.dinheiro.toFixed(2)} ({chart.dinheiro}%)</small>
                      <div style={{width:"100%", height:"12px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radiusTiny, overflow:"hidden", marginTop: "6px"}}>
                        <div style={{width:`${chart.dinheiro}%`, height:"100%", backgroundColor: modernTheme.success, transition: "width 0.3s ease"}}></div>
                      </div>
                    </div>
                    <div style={{marginBottom:"12px"}}>
                      <small style={{color: modernTheme.textLight, fontWeight: "600"}}>💳 Cartão: R$ {chart.valores.cartao.toFixed(2)} ({chart.cartao}%)</small>
                      <div style={{width:"100%", height:"12px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radiusTiny, overflow:"hidden", marginTop: "6px"}}>
                        <div style={{width:`${chart.cartao}%`, height:"100%", backgroundColor: modernTheme.info, transition: "width 0.3s ease"}}></div>
                      </div>
                    </div>
                    <div>
                      <small style={{color: modernTheme.textLight, fontWeight: "600"}}>📲 Pix: R$ {chart.valores.pix.toFixed(2)} ({chart.pix}%)</small>
                      <div style={{width:"100%", height:"12px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radiusTiny, overflow:"hidden", marginTop: "6px"}}>
                        <div style={{width:`${chart.pix}%`, height:"100%", backgroundColor: "#9c27b0", transition: "width 0.3s ease"}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "15px" }}>
              <div style={{ ...cardStyle, backgroundColor: modernTheme.primaryLight, boxShadow: modernTheme.shadow, border: `2px solid ${modernTheme.success}` }}>
                <small style={{color: modernTheme.textLight, fontWeight: "600"}}>Hoje</small>
                <strong style={{color: modernTheme.success, fontSize: "18px"}}>R$ {calcTotal(transactions, "hoje").toFixed(2)}</strong>
              </div>
              <div style={{ ...cardStyle, backgroundColor: modernTheme.primaryLight, boxShadow: modernTheme.shadow, border: `2px solid ${primaryColor}` }}>
                <small style={{color: modernTheme.textLight, fontWeight: "600"}}>Mês</small>
                <strong style={{color: primaryColor, fontSize: "18px"}}>R$ {calcTotal(transactions, "mes").toFixed(2)}</strong>
              </div>
            </div>

            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editId ? "✏️ Editar Lançamento" : "➕ Novo Lançamento Manual"}</h3>
              <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={inputStyle}>
                <option value="receita">📈 Receita (Entrada)</option>
                <option value="despesa">📉 Despesa (Saída)</option>
              </select>
              <label style={labelStyle}>📅 Data do Lançamento</label>
              <input type="date" value={dataManualFin} onChange={e => setDataManualFin(e.target.value)} style={inputStyle} />
              <input placeholder="📝 Descrição" value={descFin} onChange={e => setDescFin(e.target.value)} style={inputStyle} />
              <input placeholder="💰 Valor R$" type="number" step="0.01" value={valorFin} onChange={e => setValorFin(e.target.value)} style={inputStyle} />
              
              <label style={labelStyle}>💳 Forma de Pagamento</label>
              <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={inputStyle}>
                <option value="dinheiro">💵 Dinheiro</option>
                <option value="cartao">💳 Cartão</option>
                <option value="pix">📲 Pix</option>
              </select>
              {formaPagamento === "cartao" && (
                <select value={subTipoCartao} onChange={e => setSubTipoCartao(e.target.value)} style={inputStyle}>
                  <option value="debito">💳 Cartão de Débito</option>
                  <option value="credito">💳 Cartão de Crédito</option>
                </select>
              )}
              <button onClick={handleSaveTransaction} style={{...btnStyle, background: tipoFin==="receita" ? `linear-gradient(135deg, ${modernTheme.success}, ${modernTheme.success}dd)` : `linear-gradient(135deg, ${modernTheme.danger}, ${modernTheme.danger}dd)`}}>{editId ? "💾 Salvar Alteração" : "✅ Gravar"}</button>
              {editId && <button onClick={() => {setEditId(null); setDescFin(""); setValorFin("");}} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card, marginTop:"8px"}}>❌ Cancelar</button>}
            </section>

            <h3 style={{color: modernTheme.text, marginTop: "20px", marginBottom: "10px"}}>📋 Extrato Detalhado ({transactions.length} transações)</h3>
            {transactions.length === 0 ? (
              <div style={{...cardStyle, textAlign: "center", color: modernTheme.textMuted, boxShadow: modernTheme.shadow}}>Nenhuma transação registrada</div>
            ) : (
              transactions.sort((a,b) => b.data.localeCompare(a.data)).map(t => (
                <div key={t.id} style={{...itemStyle, marginBottom: "8px", borderRadius: modernTheme.radiusTiny, boxShadow: modernTheme.shadow}}>
                  <span style={{flex:1}}>
                    <small style={{color: modernTheme.textMuted, fontWeight: "600"}}>{new Date(t.data).toLocaleDateString("pt-BR")}</small><br/>
                    <strong style={{color: modernTheme.text}}>{t.descricao}</strong>
                    <br/>
                    <small style={{color: modernTheme.textMuted, fontSize: "11px"}}>
                      {t.formaPagamento === "dinheiro" && "💵 Dinheiro"}
                      {t.formaPagamento === "cartao" && "💳 Cartão"}
                      {t.formaPagamento === "pix" && "📲 Pix"}
                    </small>
                  </span>
                  <strong style={{color: t.tipo==="receita"? modernTheme.success : modernTheme.danger, marginRight:"10px", fontSize: "14px"}}>{t.tipo==="receita"?"+":"-"} R${t.valor.toFixed(2)}</strong>
                  <button onClick={() => {setEditId(t.id); setDescFin(t.descricao); setValorFin(t.valor); setTipoFin(t.tipo); setFormaPagamento(t.formaPagamento || "dinheiro")}} style={btnEdit}>✏️</button>
                  <button onClick={() => deleteWithConfirm("transactions", t.id, t.descricao)} style={btnDel}>🗑️</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* === ABA CLIENTES === */}
        {tab === "clientes" && (
          <div>
            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editId ? "✏️ Editar" : "👤 Novo"} Cliente</h3>
              <input placeholder="👤 Nome Completo" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
              <input placeholder="📱 Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
              <button onClick={async () => {
                if (!nomeCliente.trim()) return alert("Digite o nome do cliente");
                const d = { nome: nomeCliente, telefone, tenantId: user.uid };
                try {
                  if(editId) await updateDoc(doc(db, "clients", editId), d);
                  else await addDoc(collection(db, "clients"), d);
                  setEditId(null); setNomeCliente(""); setTelefone(""); loadData(user.uid);
                } catch (error) {
                  alert("❌ Erro: " + error.message);
                }
              }} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>✅ Salvar Cliente</button>
            </section>

            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "10px"}}>📥 Importar Clientes via CSV</h3>
              <p style={{fontSize:"12px", color: modernTheme.textLight, marginBottom:"12px", fontWeight: "600"}}>
                ✅ Formato: Nome,Telefone - Sem limite de contatos!
              </p>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleCSVImport}
                disabled={importingCSV}
                style={inputStyle}
              />
              {importingCSV && <p style={{fontSize:"12px", color: modernTheme.info, fontWeight: "600"}}>⏳ Importando...</p>}
            </section>

            <input placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "15px" }}>
              {alfabeto.map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={btnLetter(selectedLetter === l)}>{l}</button>)}
              <button onClick={() => setSelectedLetter("")} style={btnLetter(selectedLetter === "")}>Tudo</button>
            </div>
            <p style={{fontSize: "12px", color: modernTheme.textMuted, fontWeight: "600"}}>👥 Total: {clients.filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || c.nome?.toUpperCase().startsWith(selectedLetter))).length} clientes</p>

            {clients.filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || c.nome?.toUpperCase().startsWith(selectedLetter))).map(c => {
              const fidelity = getClientFidelity(c.id);
              return (
                <div key={c.id} style={{...itemStyle, borderLeft: fidelity.achieved ? `4px solid ${modernTheme.warning}` : "1px solid #eee", borderRadius: modernTheme.radiusTiny, marginBottom: "8px", boxShadow: modernTheme.shadow}}>
                  <span style={{flex:1, cursor:"pointer"}} onClick={() => {setSelectedClientForHistory(c); setShowClientHistoryModal(true);}}>
                    <strong style={{color: modernTheme.text}}>{c.nome}</strong>
                    <br/><small style={{color: modernTheme.textMuted}}>{c.telefone}</small>
                    {fidelity.achieved && <br/>}
                    {fidelity.achieved && <small style={{color: modernTheme.warning, fontWeight:"bold"}}>🎁 Prêmio atingido!</small>}
                  </span>
                  <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome); setTelefone(c.telefone)}} style={btnEdit}>✏️</button>
                  <button onClick={() => deleteWithConfirm("clients", c.id, c.nome, c.telefone)} style={btnDel}>🗑️</button>
                </div>
              );
            })}
          </div>
        )}

        {/* === ABA SERVIÇOS === */}
        {tab === "servicos" && (
          <div>
            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editId ? "✏️ Editar Serviço" : "💇 Novo Serviço"}</h3>
              
              <label style={labelStyle}>Nome do Serviço</label>
              <input placeholder="Ex: Progressiva..." value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
              
              <label style={labelStyle}>Preço R$</label>
              <input placeholder="0.00" type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />

              <label style={labelStyle}>Descrição</label>
              <textarea 
                placeholder="Detalhes..." 
                value={descServico} 
                onChange={e => setDescServico(e.target.value)} 
                style={{...inputStyle, height: "80px", resize: "none"}} 
              />

              <label style={labelStyle}>⏱️ Tempo de Duração</label>
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <div style={{flex: 1}}>
                  <small style={{fontWeight: "600", color: modernTheme.textLight}}>Horas</small>
                  <input type="number" value={tempoHoras} onChange={e => setTempoHoras(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={{flex: 1}}>
                  <small style={{fontWeight: "600", color: modernTheme.textLight}}>Minutos</small>
                  <input type="number" value={tempoMinutos} onChange={e => setTempoMinutos(Number(e.target.value))} style={inputStyle} />
                </div>
              </div>

              <button onClick={async () => {
                const duracaoTotal = (tempoHoras * 60) + tempoMinutos;
                if (!nomeServico.trim() || !preco || duracaoTotal <= 0) {
                  return alert("Preencha o nome, preço e a duração do serviço!");
                }

                const d = { 
                  nome: nomeServico, 
                  preco: Number(preco), 
                  duracao: duracaoTotal, 
                  descricao: descServico,
                  tenantId: user.uid 
                };

                try {
                  if(editId) await updateDoc(doc(db, "services", editId), d);
                  else await addDoc(collection(db, "services"), d);
                  
                  setEditId(null); setNomeServico(""); setPreco(""); 
                  setDescServico(""); setTempoHoras(0); setTempoMinutos(30);
                  loadData(user.uid);
                  alert("✅ Serviço salvo!");
                } catch (error) {
                  alert("❌ Erro: " + error.message);
                }
              }} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>
                {editId ? "💾 Salvar Alterações" : "➕ Cadastrar Serviço"}
              </button>
              {editId && <button onClick={() => {setEditId(null); setNomeServico(""); setPreco(""); setDescServico(""); setTempoHoras(0); setTempoMinutos(30);}} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card, marginTop:"8px"}}>❌ Cancelar</button>}
            </section>

            <h3 style={{color: modernTheme.text, marginTop: "20px", marginBottom: "10px"}}>💇 Serviços Cadastrados ({services.length})</h3>
            {services.length === 0 ? (
              <div style={{...cardStyle, textAlign: "center", color: modernTheme.textMuted, boxShadow: modernTheme.shadow}}>Nenhum serviço cadastrado</div>
            ) : (
              services.map(s => (
                <div key={s.id} style={{...itemStyle, borderRadius: modernTheme.radiusTiny, marginBottom: "8px", boxShadow: modernTheme.shadow}}>
                  <span style={{flex:1}}>
                    <strong style={{color: modernTheme.text}}>{s.nome}</strong><br/>
                    <small style={{color: modernTheme.textLight, fontWeight: "600"}}>R${s.preco.toFixed(2)} - {s.duracao >= 60 ? `${Math.floor(s.duracao/60)}h ${s.duracao%60}min` : `${s.duracao}min`}</small>
                    {s.descricao && <><br/><small style={{color: modernTheme.textMuted, fontStyle: "italic"}}>{s.descricao}</small></>}
                  </span>
                  <button onClick={() => {
                    setEditId(s.id); 
                    setNomeServico(s.nome); 
                    setPreco(s.preco);
                    setDescServico(s.descricao || "");
                    setTempoHoras(Math.floor(s.duracao / 60));
                    setTempoMinutos(s.duracao % 60);
                  }} style={btnEdit}>✏️</button>
                  <button onClick={() => deleteWithConfirm("services", s.id, s.nome)} style={btnDel}>🗑️</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* === ABA ESTOQUE === */}
        {tab === "estoque" && (
          <div>
            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editProductId ? "✏️ Editar Produto" : "📦 Novo Produto"}</h3>
              <input placeholder="📦 Nome do Produto" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} style={inputStyle} />
              <input placeholder="📊 Quantidade" type="number" value={qtdProduto} onChange={e => setQtdProduto(e.target.value)} style={inputStyle} />
              <input placeholder="⚠️ Alerta Crítico (mín)" type="number" value={alerta} onChange={e => setAlerta(e.target.value)} style={inputStyle} />
              <button onClick={handleSaveProduct} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>{editProductId ? "💾 Atualizar" : "➕ Adicionar"}</button>
              {editProductId && <button onClick={() => {setEditProductId(null); setNomeProduto(""); setQtdProduto(""); setAlerta("");}} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card, marginTop:"8px"}}>❌ Cancelar</button>}
            </section>

            <h3 style={{color: modernTheme.text, marginTop: "20px", marginBottom: "10px"}}>📦 Inventário ({inventory.length})</h3>
            {inventory.length === 0 ? (
              <div style={{...cardStyle, textAlign: "center", color: modernTheme.textMuted, boxShadow: modernTheme.shadow}}>Nenhum produto cadastrado</div>
            ) : (
              inventory.map(prod => {
                const critico = Number(prod.quantidade) <= Number(prod.alertaCritico);
                return (
                  <div key={prod.id} style={{...itemStyle, borderLeft: critico ? `4px solid ${modernTheme.danger}` : `4px solid ${modernTheme.success}`, backgroundColor: critico ? modernTheme.primaryLight : modernTheme.card, borderRadius: modernTheme.radiusTiny, marginBottom: "8px", boxShadow: modernTheme.shadow}}>
                    <span style={{flex:1}}>
                      <strong style={{color: modernTheme.text}}>{prod.nome}</strong><br/>
                      <small style={{color: modernTheme.textLight, fontWeight: "600"}}>{prod.quantidade} un. {critico && <span style={{color: modernTheme.danger, fontWeight:"bold"}}>⚠️ CRÍTICO</span>}</small>
                    </span>
                    <button onClick={() => {setEditProductId(prod.id); setNomeProduto(prod.nome); setQtdProduto(prod.quantidade); setAlerta(prod.alertaCritico);}} style={btnEdit}>✏️</button>
                    <button onClick={() => deleteWithConfirm("inventory", prod.id, prod.nome)} style={btnDel}>🗑️</button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* === ABA RETORNOS === */}
        {tab === "retornos" && (
          <div>
            <div style={{...cardStyle, boxShadow: modernTheme.shadow, borderLeft: `4px solid ${primaryColor}`}}>
              <h3 style={{borderBottom: `2px solid ${primaryColor}`, paddingBottom: "10px", color: modernTheme.text, margin: "0 0 10px 0"}}>🔄 Sugestão de Retorno (30 dias)</h3>
              <p style={{fontSize: "12px", color: modernTheme.textLight, marginBottom: "0", fontWeight: "500"}}>Clientes que completam 30 dias desde o último atendimento.</p>
            </div>

            {clients.length === 0 ? (
              <div style={{...cardStyle, textAlign: "center", color: modernTheme.textMuted, boxShadow: modernTheme.shadow, marginTop: "15px"}}>Nenhuma cliente cadastrada</div>
            ) : (
              clients.map(cli => {
                const history = getClientHistory(cli.id);
                if (history.count === 0) return null;
                const ultimaData = new Date(history.apps[0].dataHora);
                const dataRetorno = new Date(ultimaData);
                dataRetorno.setDate(dataRetorno.getDate() + 30);
                
                return (
                  <div key={cli.id} style={{...itemStyle, borderLeft: `4px solid ${primaryColor}`, borderRadius: modernTheme.radiusTiny, marginTop: "10px", boxShadow: modernTheme.shadow}}>
                    <span style={{flex: 1}}>
                      <strong style={{color: modernTheme.text}}>{cli.nome}</strong><br/>
                      <small style={{color: modernTheme.textLight, fontWeight: "600"}}>Último: {ultimaData.toLocaleDateString("pt-BR")}</small><br/>
                      <small style={{color: primaryColor, fontWeight: "bold"}}>📅 Retorno: {dataRetorno.toLocaleDateString("pt-BR")}</small>
                    </span>
                    <button onClick={() => {
                      setSelectedDate(dataRetorno);
                      setTab("agenda");
                    }} style={{...btnStyle, width: "auto", padding: "6px 12px", fontSize: "12px", background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>Agendar</button>
                  </div>
                );
              }).filter(item => item !== null)
            )}
          </div>
        )}

        {/* === ABA PERFIL === */}
        {tab === "perfil" && (
          <div>
            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>⚙️ Perfil da Profissional</h3>
              {!editingProfile ? (
                <div>
                  <div style={{ marginBottom: "20px", textAlign: "center", padding: "20px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radius }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ width: "100px", height: "100px", borderRadius: "50%", objectFit: "cover", marginBottom: "15px", border: `3px solid ${primaryColor}` }} />
                    ) : (
                      <div style={{ width: "100px", height: "100px", borderRadius: "50%", backgroundColor: primaryColor, margin: "0 auto 15px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "40px" }}>📷</div>
                    )}
                    <p style={{ margin: "8px 0", fontSize: "16px", fontWeight: "bold", color: modernTheme.text }}>{nomeEmpresa || "Seu Salão"}</p>
                    <p style={{ margin: "5px 0", fontSize: "13px", color: modernTheme.textLight }}>{telefoneProfissional || "Telefone não definido"}</p>
                    <p style={{ margin: "5px 0", fontSize: "12px", color: modernTheme.textMuted }}>
                      🕐 {horarioAbertura} às {horarioFechamento}
                    </p>
                    <p style={{ margin: "5px 0", fontSize: "12px", color: modernTheme.textMuted }}>
                      🎁 Fidelidade: A cada {fidelidadeLimit} atendimentos
                    </p>
                  </div>
                  <button onClick={() => setEditingProfile(true)} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`, marginBottom: "8px"}}>✏️ Editar Perfil</button>
                  <button onClick={printReport} style={{...btnStyle, background: `linear-gradient(135deg, ${modernTheme.warning}, ${modernTheme.warning}dd)`}}>🖨️ Imprimir Relatório</button>
                </div>
              ) : (
                <div>
                  <input 
                    placeholder="Nome da Empresa/Salão" 
                    value={nomeEmpresa} 
                    onChange={e => setNomeEmpresa(e.target.value)} 
                    style={inputStyle} 
                  />
                  
                  <label style={labelStyle}>🎨 Cor Principal do Sistema</label>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "15px", alignItems: "center" }}>
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ width: "60px", height: "50px", border: "none", cursor: "pointer", borderRadius: modernTheme.radiusTiny }}
                    />
                    <div style={{ flex: 1, fontSize: "12px", color: modernTheme.textLight, fontWeight: "500" }}>
                      Escolha a cor que melhor representa seu salão. Isso mudará todos os botões, títulos e destaques do sistema!
                    </div>
                  </div>

                  <label style={labelStyle}>📷 Logo do Salão</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                    disabled={uploadingLogo}
                    style={inputStyle} 
                  />
                  {uploadingLogo && <p style={{fontSize:"12px", color: modernTheme.info, fontWeight: "600"}}>⏳ Enviando...</p>}
                  {logoUrl && (
                    <div style={{ textAlign: "center", marginBottom: "15px", padding: "10px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radiusTiny }}>
                      <img src={logoUrl} alt="Preview" style={{ width: "70px", height: "70px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${primaryColor}` }} />
                      <p style={{ fontSize: "11px", color: modernTheme.success, margin: "8px 0 0 0", fontWeight: "600" }}>✅ Logo atualizado</p>
                    </div>
                  )}

                  <input 
                    placeholder="📞 Telefone de Contato" 
                    value={telefoneProfissional} 
                    onChange={e => setTelefoneProfissional(e.target.value)} 
                    style={inputStyle} 
                  />
                  <label style={labelStyle}>🕐 Horário de Abertura</label>
                  <input 
                    type="time"
                    value={horarioAbertura} 
                    onChange={e => setHorarioAbertura(e.target.value)} 
                    style={inputStyle} 
                  />

                  <label style={labelStyle}>🕐 Horário de Fechamento</label>
                  <input 
                    type="time"
                    value={horarioFechamento} 
                    onChange={e => setHorarioFechamento(e.target.value)} 
                    style={inputStyle} 
                  />

                  <label style={labelStyle}>🎁 Limite de Fidelidade (atendimentos)</label>
                  <input 
                    type="number"
                    value={fidelidadeLimit}
                    onChange={e => setFidelidadeLimit(Number(e.target.value))}
                    style={inputStyle}
                  />

                  <label style={labelStyle}>⚙️ Dias de Atendimento</label>
                  <div style={{ display: "grid", gap: "8px", marginBottom: "15px" }}>
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((nome, index) => (
                      <div key={index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: `1px solid ${primaryColor}20`, borderRadius: modernTheme.radius, backgroundColor: gradeHorarios[index].aberta ? primaryColor + "10" : modernTheme.card }}>
                        <span style={{fontSize: "13px", fontWeight: "bold", color: modernTheme.text}}>{nome}</span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => setGradeHorarios({...gradeHorarios, [index]: {...gradeHorarios[index], aberta: !gradeHorarios[index].aberta}})}
                            style={{ padding: "6px 12px", fontSize: "11px", backgroundColor: gradeHorarios[index].aberta ? modernTheme.success : modernTheme.textMuted, color: "white", border: "none", borderRadius: modernTheme.radiusTiny, cursor: "pointer", fontWeight: "bold", transition: "all 0.2s ease" }}>
                            {gradeHorarios[index].aberta ? "✅ ABERTO" : "❌ FECHADO"}
                          </button>
                          {gradeHorarios[index].aberta && (
                            <select value={gradeHorarios[index].tipo || "janela"} onChange={(e) => setGradeHorarios({...gradeHorarios, [index]: {...gradeHorarios[index], tipo: e.target.value, horas: e.target.value === "fixo" ? [7,9] : []}})} style={{fontSize: "11px", padding: "6px 8px", borderRadius: modernTheme.radiusTiny, border: `1px solid ${primaryColor}`, backgroundColor: modernTheme.card, cursor: "pointer", fontWeight: "500"}}>
                              <option value="janela">Normal</option>
                              <option value="fixo">7h e 9h</option>
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={handleSaveProfile} style={{...btnStyle, background: `linear-gradient(135deg, ${modernTheme.success}, ${modernTheme.success}dd)`, marginBottom: "8px"}}>💾 Salvar Alterações</button>
                  <button onClick={() => setEditingProfile(false)} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card}}>❌ Cancelar</button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ========== 🤖 BOTÃO FLUTUANTE DA IA ========== */}
      <button 
        onClick={() => setShowAI(!showAI)}
        style={{
          position: "fixed", 
          bottom: "30px", 
          right: "20px",
          width: "70px", 
          height: "70px", 
          borderRadius: "50%",
          backgroundColor: primaryColor, 
          color: "white",
          border: "none", 
          boxShadow: modernTheme.shadowHeavy,
          fontSize: "28px", 
          cursor: "pointer", 
          zIndex: 2000,
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          transition: "all 0.3s ease",
          fontWeight: "bold"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Gerente Virtual IA"
      >
        {showAI ? "✖️" : "🤖"}
      </button>

      {/* ========== 🤖 BARRA LATERAL DA IA COM BOTÕES DE AÇÃO RÁPIDA ========== */}
      {showAI && (
        <div style={{
          position: "fixed", 
          top: 0, 
          right: 0, 
          width: "340px", 
          height: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.95)", 
          backdropFilter: "blur(15px)",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", 
          zIndex: 1999,
          padding: "0",
          display: "flex", 
          flexDirection: "column",
          animation: "slideInRight 0.3s ease-out",
          overflowY: "auto"
        }}>
          {/* HEADER DO CHAT */}
          <div style={{ 
            padding: "20px 15px", 
            backgroundColor: primaryColor, 
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: `3px solid ${primaryColor}60`,
            position: "sticky",
            top: 0,
            zIndex: 10
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
              🤖 Gerente Virtual
            </h3>
            <button 
              onClick={() => setShowAI(false)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => e.target.style.transform = "scale(1.2)"}
              onMouseOut={(e) => e.target.style.transform = "scale(1)"}
            >
              ✕
            </button>
          </div>

          {/* HISTÓRICO DE CHAT */}
          <div style={{ 
            flex: 1, 
            overflowY: "auto", 
            padding: "15px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            {/* PRIMEIRA MENSAGEM (Resposta Inicial) */}
            <div style={{
              backgroundColor: modernTheme.primaryLight,
              padding: "12px",
              borderRadius: modernTheme.radius,
              fontSize: "13px",
              color: modernTheme.text,
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              borderLeft: `4px solid ${primaryColor}`
            }}>
              {aiResponse}
            </div>

            {/* HISTÓRICO DE CONVERSAS COM AÇÕES RÁPIDAS */}
            {aiChatHistory.map((chat, index) => (
              <div key={index}>
                {/* Pergunta do Usuário */}
                <div style={{
                  backgroundColor: primaryColor,
                  color: "white",
                  padding: "10px",
                  borderRadius: modernTheme.radius,
                  fontSize: "12px",
                  textAlign: "right",
                  marginLeft: "30px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }}>
                  {chat.pergunta}
                </div>

                {/* Resposta da IA */}
                <div style={{
                  backgroundColor: modernTheme.primaryLight,
                  padding: "10px",
                  borderRadius: modernTheme.radius,
                  fontSize: "12px",
                  color: modernTheme.text,
                  textAlign: "left",
                  marginRight: "30px",
                  marginTop: "6px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  borderLeft: `3px solid ${primaryColor}`
                }}>
                  {chat.resposta}
                </div>

                {/* BOTÕES DE AÇÃO RÁPIDA */}
                {chat.acoes && chat.acoes.tipo === "sumidas" && (
                  <div style={{
                    marginRight: "30px",
                    marginTop: "8px",
                    marginBottom: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}>
                    {chat.acoes.clientes.map((cliente, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          sendCobrancaWhatsApp(cliente);
                          alert(`✅ WhatsApp aberto para ${cliente.nome}!`);
                        }}
                        style={{
                          padding: "8px 10px",
                          backgroundColor: "#25D366",
                          color: "white",
                          border: "none",
                          borderRadius: modernTheme.radiusTiny,
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          justifyContent: "center"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.opacity = "0.9";
                          e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.opacity = "1";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        📲 Cobrar {cliente.nome}
                      </button>
                    ))}
                  </div>
                )}

                {/* AÇÃO RÁPIDA: Cliente Específico */}
                {chat.acoes && chat.acoes.tipo === "cliente" && chat.acoes.cliente && (
                  <div style={{
                    marginRight: "30px",
                    marginTop: "8px",
                    marginBottom: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}>
                    <button
                      onClick={() => {
                        sendCobrancaWhatsApp(chat.acoes.cliente);
                        alert(`✅ WhatsApp aberto para ${chat.acoes.cliente.nome}!`);
                      }}
                      style={{
                        padding: "8px 10px",
                        backgroundColor: "#25D366",
                        color: "white",
                        border: "none",
                        borderRadius: modernTheme.radiusTiny,
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "bold",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.opacity = "0.9";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      📲 Enviar WhatsApp
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* INPUT DE PERGUNTA */}
          <div style={{ 
            padding: "15px",
            borderTop: `1px solid ${primaryColor}20`,
            backgroundColor: "rgba(255,255,255,0.8)",
            position: "sticky",
            bottom: 0,
            zIndex: 10
          }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input 
                placeholder="Pergunte sobre..."
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && aiQuery.trim()) {
                    setAiResponse(askAI(aiQuery));
                    setAiQuery("");
                  }
                }}
                style={{ 
                  flex: 1,
                  padding: "10px",
                  borderRadius: modernTheme.radiusTiny,
                  border: `1px solid ${primaryColor}40`,
                  fontSize: "12px",
                  fontFamily: "inherit"
                }}
              />
              <button 
                onClick={() => {
                  if (aiQuery.trim()) {
                    setAiResponse(askAI(aiQuery));
                    setAiQuery("");
                  }
                }}
                style={{
                  padding: "10px 14px",
                  backgroundColor: primaryColor,
                  color: "white",
                  border: "none",
                  borderRadius: modernTheme.radiusTiny,
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  transition: "all 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                📤
              </button>
            </div>

            {/* SUGESTÕES RÁPIDAS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {[
                { icon: "📅", texto: "Hoje", query: "Meus horários hoje" },
                { icon: "💰", texto: "Caixa", query: "Meu financeiro" },
                { icon: "👥", texto: "Clientes", query: "Quantos clientes tenho" },
                { icon: "🔄", texto: "Ausentes", query: "Clientes sumidas" }
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setAiResponse(askAI(btn.query));
                    setAiQuery("");
                  }}
                  style={{
                    padding: "8px",
                    backgroundColor: modernTheme.primaryLight,
                    border: `1px solid ${primaryColor}40`,
                    borderRadius: modernTheme.radiusTiny,
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: modernTheme.text,
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = primaryColor;
                    e.currentTarget.style.color = "white";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = modernTheme.primaryLight;
                    e.currentTarget.style.color = modernTheme.text;
                  }}
                >
                  {btn.icon} {btn.texto}
                </button>
              ))}
            </div>
          </div>

          {/* Animação de entrada */}
          <style>
            {`
              @keyframes slideInRight {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
            `}
          </style>
        </div>
      )}

      {/* === MODAIS === */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={{...modalContent, boxShadow: modernTheme.shadowHeavy, borderTop: `4px solid ${primaryColor}`}}>
            <h3 style={{color: primaryColor, marginTop: 0}}>📅 {editAppId ? "Editar" : "Novo"} Agendamento {String(selHora).padStart(2, "0")}:00</h3>
            <div style={{position:"relative"}}>
              <input placeholder="🔍 Nome da cliente..." value={clientSearch} onChange={e => {setClientSearch(e.target.value); setSelCliente("");}} style={inputStyle} />
              {clientSearch && !selCliente && (
                <div style={dropdownStyle}>
                  {clients.filter(c => c.nome.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 5).map(c => (
                    <div key={c.id} onClick={() => {setSelCliente(c.id); setClientSearch(c.nome)}} style={{...dropdownItem, cursor: "pointer", borderLeft: `3px solid ${primaryColor}`}}>
                      {c.nome} <small style={{color: modernTheme.textMuted}}>({c.telefone})</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
              <option value="">Selecione o Serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R${s.preco.toFixed(2)})</option>)}
            </select>
            <button onClick={async () => {
              if(!selCliente || !selServico) return alert("Selecione Cliente e Serviço!");
              const dFinal = new Date(selectedDate); dFinal.setHours(selHora, 0, 0, 0);
              const d = { clientId: selCliente, serviceId: selServico, dataHora: dFinal.toISOString(), status: "pendente", tenantId: user.uid };
              try {
                if(editAppId) await updateDoc(doc(db, "appointments", editAppId), d);
                else await addDoc(collection(db, "appointments"), d);
                setShowModal(false); loadData(user.uid);
              } catch (error) {
                alert("❌ Erro: " + error.message);
              }
            }} style={{...btnStyle, background: `linear-gradient(135deg, ${modernTheme.success}, ${modernTheme.success}dd)`}}>✅ Confirmar</button>
            <button onClick={() => setShowModal(false)} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card, marginTop:"8px"}}>❌ Cancelar</button>
          </div>
        </div>
      )}

      {showPaymentModal && selectedAppForPayment && (
        <div style={modalOverlay}>
          <div style={{...modalContent, boxShadow: modernTheme.shadowHeavy, borderTop: `4px solid ${primaryColor}`}}>
            <h3 style={{color: primaryColor, marginTop: 0}}>💳 Confirmar Pagamento</h3>
            <div style={{textAlign:"center", marginBottom:"15px", padding: "12px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radius, borderLeft: `4px solid ${primaryColor}`}}>
              <p style={{margin:"5px 0", fontWeight: "bold", color: modernTheme.text}}>{getNome(clients, selectedAppForPayment.clientId)}</p>
              <p style={{margin:"5px 0", fontSize:"13px", color: modernTheme.textLight, fontWeight: "600"}}>
                {getNome(services, selectedAppForPayment.serviceId)} - R${services.find(s => s.id === selectedAppForPayment.serviceId)?.preco.toFixed(2) || "0.00"}
              </p>
            </div>
            
            <label style={labelStyle}>💳 Forma de Pagamento</label>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={inputStyle}>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="cartao">💳 Cartão</option>
              <option value="pix">📲 Pix</option>
            </select>

            <button onClick={confirmPayment} style={{...btnStyle, background: `linear-gradient(135deg, ${modernTheme.success}, ${modernTheme.success}dd)`, marginBottom: "8px"}}>✅ Receber Pagamento</button>
            <button onClick={() => setShowPaymentModal(false)} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card}}>❌ Cancelar</button>
          </div>
        </div>
      )}

      {showClientHistoryModal && selectedClientForHistory && (() => {
        const history = getClientHistory(selectedClientForHistory.id);
        const fidelity = getClientFidelity(selectedClientForHistory.id);
        return (
          <div style={modalOverlay}>
            <div style={{...modalContent, maxHeight:"80vh", overflowY:"auto", boxShadow: modernTheme.shadowHeavy, borderTop: `4px solid ${primaryColor}`}}>
              <h3 style={{color: primaryColor, marginTop: 0}}>📂 Histórico de {selectedClientForHistory.nome}</h3>
              <p style={{fontSize:"12px", color: modernTheme.textLight, fontWeight: "600"}}>
                📞 {selectedClientForHistory.telefone}
              </p>
              
              <div style={{...cardStyle, backgroundColor: modernTheme.primaryLight, borderLeft: `4px solid ${primaryColor}`, boxShadow: "none", marginBottom: "15px"}}>
                <p style={{margin:"5px 0", fontSize: "13px"}}><strong style={{color: modernTheme.text}}>Total Gasto:</strong> <span style={{color: primaryColor, fontSize: "16px", fontWeight: "bold"}}>R$ {history.totalGasto.toFixed(2)}</span></p>
                <p style={{margin:"5px 0", fontSize: "13px"}}><strong style={{color: modernTheme.text}}>Atendimentos:</strong> <span style={{fontWeight: "bold", color: primaryColor}}>{history.count}</span></p>
                <p style={{margin:"5px 0", fontSize: "13px", color: fidelity.achieved ? modernTheme.warning : modernTheme.textMuted}}>
                  <strong style={{color: modernTheme.text}}>Fidelidade:</strong> <span style={{fontWeight: "bold"}}>{fidelity.count}/{fidelity.limit}</span> {fidelity.achieved && "🎁 Prêmio atingido!"}
                </p>
              </div>

              <h4 style={{marginTop: "15px", marginBottom: "10px", color: modernTheme.text, fontSize: "13px", fontWeight: "bold"}}>Agendamentos Registrados:</h4>
              {history.apps.length > 0 ? history.apps.map(a => {
                const serv = services.find(s => s.id === a.serviceId);
                return (
                  <div key={a.id} style={{...itemStyle, fontSize:"12px", borderRadius: modernTheme.radiusTiny, marginBottom: "8px", borderLeft: `3px solid ${a.status === "pago" ? modernTheme.success : modernTheme.warning}`}}>
                    <span style={{flex:1}}>
                      <strong style={{color: modernTheme.text}}>{new Date(a.dataHora).toLocaleDateString("pt-BR")} às {String(new Date(a.dataHora).getHours()).padStart(2, "0")}:00</strong><br/>
                      {serv?.nome}<br/>
                      <small style={{color: a.status === "pago" ? modernTheme.success : modernTheme.warning, fontWeight:"bold"}}>Status: {a.status === "pago" ? "✅ Pago" : "⏳ Pendente"}</small>
                    </span>
                    <strong style={{color: modernTheme.success}}>R$ {serv?.preco.toFixed(2)}</strong>
                  </div>
                );
              }) : <p style={{fontSize:"12px", color: modernTheme.textMuted, textAlign: "center", padding: "15px"}}>Nenhum agendamento registrado</p>}

              <button onClick={() => setShowClientHistoryModal(false)} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card, marginTop:"10px"}}>Fechar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ========== NOMES DOS MESES ==========
const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// ========== FUNÇÕES AUXILIARES ==========
const calcTotal = (list, p) => {
  const h = new Date().toLocaleDateString("pt-BR");
  const m = new Date().getMonth();
  return list.filter(t => {
    const d = new Date(t.data);
    return (p === "hoje" ? d.toLocaleDateString("pt-BR") === h : d.getMonth() === m) && t.tipo === "receita";
  }).reduce((acc, c) => acc + c.valor, 0);
};

// ========== ESTILOS CENTRALIZADOS ==========
const inputStyle = { 
  width: "100%", 
  padding: "12px", 
  marginBottom: "12px", 
  borderRadius: "8px", 
  border: "1px solid #e0e0e0",
  boxSizing: "border-box", 
  fontSize: "14px",
  fontFamily: "inherit",
  transition: "all 0.3s ease"
};

const labelStyle = { 
  fontSize: "12px", 
  fontWeight: "bold", 
  display: "block", 
  marginBottom: "6px",
  color: "#2d3436",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const btnStyle = { 
  width: "100%", 
  padding: "14px", 
  color: "white", 
  border: "none", 
  borderRadius: "8px", 
  cursor: "pointer", 
  fontWeight: "bold", 
  fontSize: "14px",
  transition: "all 0.3s ease",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
};

const btnMini = { 
  padding: "8px 14px", 
  backgroundColor: "#eee", 
  border: "none", 
  borderRadius: "6px", 
  cursor: "pointer", 
  fontSize: "12px",
  fontWeight: "600",
  transition: "all 0.2s ease"
};

const itemStyle = { 
  display: "flex", 
  alignItems: "center", 
  padding: "12px", 
  borderBottom: "1px solid #eee", 
  fontSize: "13px", 
  backgroundColor: "#fff"
};

const cardStyle = { 
  padding: "15px", 
  borderRadius: "12px", 
  marginBottom: "15px", 
  border: "none",
  backgroundColor: "#fff"
};

const modalOverlay = { 
  position: "fixed", 
  top: 0, 
  left: 0, 
  width: "100%", 
  height: "100%", 
  backgroundColor: "rgba(0,0,0,0.5)", 
  display: "flex", 
  justifyContent: "center", 
  alignItems: "center", 
  zIndex: 1000
};

const modalContent = { 
  backgroundColor: "#fff", 
  padding: "20px", 
  borderRadius: "15px", 
  width: "90%", 
  maxWidth: "350px"
};

const dropdownStyle = { 
  position: "absolute", 
  top: "50px", 
  left: 0, 
  width: "100%", 
  backgroundColor: "#fff", 
  border: "1px solid #ccc", 
  zIndex: 10, 
  maxHeight: "150px", 
  overflowY: "auto", 
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
};

const dropdownItem = { 
  padding: "10px 12px", 
  borderBottom: "1px solid #eee", 
  fontSize: "13px"
};

const btnPay = { 
  backgroundColor: "#4caf50", 
  color: "#fff", 
  border: "none", 
  borderRadius: "6px", 
  padding: "6px 10px", 
  marginLeft: "5px", 
  cursor: "pointer", 
  fontSize: "12px", 
  fontWeight: "bold",
  transition: "all 0.2s ease"
};

const btnWhatsApp = { 
  backgroundColor: "#25D366", 
  color: "#fff", 
  border: "none", 
  borderRadius: "6px", 
  padding: "6px 10px", 
  marginLeft: "5px", 
  cursor: "pointer", 
  fontSize: "12px", 
  fontWeight: "bold",
  transition: "all 0.2s ease"
};

const btnDel = { 
  backgroundColor: "#ffcdd2", 
  color: "#c62828", 
  border: "none", 
  borderRadius: "6px", 
  padding: "6px 10px", 
  marginLeft: "5px", 
  cursor: "pointer", 
  fontSize: "12px", 
  fontWeight: "bold",
  transition: "all 0.2s ease"
};

const btnEdit = { 
  backgroundColor: "#e1f5fe", 
  color: "#0277bd", 
  border: "none", 
  borderRadius: "6px", 
  padding: "6px 10px", 
  cursor: "pointer", 
  fontSize: "12px", 
  fontWeight: "bold",
  transition: "all 0.2s ease"
};

const btnLetter = (active) => ({ 
  padding: "5px 8px", 
  minWidth: "28px", 
  fontSize: "10px", 
  backgroundColor: active ? "#d81b60" : "#f0f0f0", 
  color: active ? "white" : "#333", 
  border: "1px solid #ddd", 
  borderRadius: "4px", 
  cursor: "pointer",
  fontWeight: active ? "bold" : "500",
  transition: "all 0.2s ease"
});
