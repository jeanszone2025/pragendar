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



  // ========== UPLOAD DE LOGO (VERSÃO ÚNICA E CORRIGIDA) ==========

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



  // ========== IMPORTAÇÃO CSV UNIFICADA (NOME COMPLETO + TELEFONE GARANTIDO) ✨ ==========

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

        updatedAt: new Date().toISOString()

      }, { merge: true });



      setEditingProfile(false);

      loadProfile(user.uid);

      alert("✅ Perfil salvo com sucesso!");

    } catch (error) {

      alert("❌ Erro ao salvar perfil: " + error.message);

    }

  };



  // ========== LÓGICA DE BLOQUEIO DE HORÁRIOS (JANELA DE OCUPAÇÃO) ==========

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



  // ========== DASHBOARD GRÁFICOS DE FATURAMENTO ==========

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



  // ========== MODAL DE PAGAMENTO COM SELEÇÃO DE FORMA ==========

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



  // ========== FUNÇÃO DE LEMBRETE WHATSAPP ==========

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

      alert("❌ Erro ao salvar transação: " + error.message);

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

h1 { text-align: center; color: #d81b60; margin-bottom: 10px; }

.data-relatorio { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }

.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }

.card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }

.card strong { display: block; color: #d81b60; margin-bottom: 10px; }

.card small { display: block; font-size: 11px; color: #666; margin-top: 5px; }

table { width: 100%; border-collapse: collapse; margin: 20px 0; }

th { background: #d81b60; color: white; padding: 12px; text-align: left; font-weight: bold; }

td { border: 1px solid #ddd; padding: 10px; font-size: 12px; }

tr:nth-child(even) { background: #f5f5f5; }

.total-row { font-weight: bold; background: #ffe0ec; }

@media print {

body { margin: 0; padding: 0; }

.no-print { display: none; }

button { display: none; }

}

</style>

</head>

<body>

<div class="container">

<h1>${nomeEmpresa || "Pragendar R$"}</h1>

<p class="data-relatorio">Relatório Financeiro de ${dataAtual}</p>



<h2 style="color: #d81b60; border-bottom: 2px solid #d81b60; padding-bottom: 10px;">Resumo Financeiro</h2>

<div class="summary">

<div class="card">

<strong>💵 Dinheiro</strong>

R$ ${chart.valores.dinheiro.toFixed(2)}<br/>

<small>${chart.dinheiro}%</small>

</div>

<div class="card">

<strong>💳 Cartão</strong>

R$ ${chart.valores.cartao.toFixed(2)}<br/>

<small>${chart.cartao}%</small>

</div>

<div class="card">

<strong>📲 Pix</strong>

R$ ${chart.valores.pix.toFixed(2)}<br/>

<small>${chart.pix}%</small>

</div>

</div>

<div style="background: #d81b60; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">

<h3 style="margin: 0; font-size: 28px;">R$ ${chart.total}</h3>

<small>Total Recebido</small>

</div>



<h2 style="color: #d81b60; border-bottom: 2px solid #d81b60; padding-bottom: 10px;">Agendamentos Realizados</h2>

<table>

<thead>

<tr>

<th>Data/Hora</th>

<th>Cliente</th>

<th>Serviço</th>

<th>Valor</th>

<th>Status</th>

</tr>

</thead>

<tbody>

${appointments.map(a => {

  const serv = services.find(s => s.id === a.serviceId);

  const valor = serv?.preco || 0;

  return `

<tr>

<td>${new Date(a.dataHora).toLocaleDateString("pt-BR")} ${String(new Date(a.dataHora).getHours()).padStart(2, "0")}:${String(new Date(a.dataHora).getMinutes()).padStart(2, "0")}</td>

<td>${getNome(clients, a.clientId)}</td>

<td>${getNome(services, a.serviceId)}</td>

<td>R$ ${valor}</td>

<td>${a.status === "pago" ? "✅ Pago" : "⏳ Pendente"}</td>

</tr>

`;

}).join("")}

<tr class="total-row">

<td colspan="3" style="text-align: right;">TOTAL FATURADO:</td>

<td colspan="2">R$ ${appointments.filter(a => a.status === "pago").reduce((acc, a) => {

  const serv = services.find(s => s.id === a.serviceId);

  return acc + (serv?.preco || 0);

}, 0).toFixed(2)}</td>

</tr>

</tbody>

</table>



<h2 style="color: #d81b60; border-bottom: 2px solid #d81b60; padding-bottom: 10px; margin-top: 30px;">Resumo de Clientes</h2>

<p style="font-size: 12px; color: #666;">Total de clientes: <strong>${clients.length}</strong> | Total de atendimentos: <strong>${appointments.length}</strong></p>



<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 11px;">

<p>Relatório gerado automaticamente pelo Pragendar R$ em ${new Date().toLocaleString("pt-BR")}</p>

<p>Este documento é confidencial e destinado apenas ao uso interno da empresa.</p>

</div>

</div>

<script>window.print(); window.close();</script>

</body>

</html>`;

    win.document.write(html);

    win.document.close();

  };



  // ========== RENDERIZAÇÃO CONDICIONAL - TELA DE LOGIN ==========

  if (!user) {

    return (

      <div style={{ padding: "40px 20px", fontFamily: "sans-serif", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", backgroundColor: "#fafafa" }}>

        <h1 style={{ color: "#d81b60", marginBottom: "30px", fontSize: "2.5rem" }}>Pragendar R$</h1>

        <p style={{ color: "#999", marginBottom: "30px", fontSize: "14px" }}>Sistema de Gestão de Agendamentos</p>

        <div style={cardStyle}>

          <h3 style={{marginTop: 0}}>{authTab === "login" ? "Entrar" : "Criar Conta"}</h3>

          <form onSubmit={handleAuth}>

            <input 

              placeholder="E-mail" 

              type="email"

              value={email} 

              onChange={e => setEmail(e.target.value)} 

              style={inputStyle} 

              required

            />

            <input 

              placeholder="Senha" 

              type="password" 

              value={password} 

              onChange={e => setPassword(e.target.value)} 

              style={inputStyle}

              required

            />

            <button type="submit" style={btnStyle}>

              {authTab === "login" ? "Entrar" : "Cadastrar"}

            </button>

          </form>

          <p onClick={() => setAuthTab(authTab === "login" ? "cadastro" : "login")} style={{ cursor: "pointer", color: "#d81b60", marginTop: "15px", fontSize: "14px" }}>

            {authTab === "login" ? "Novo por aqui? Cadastre-se" : "Já tem conta? Faça Login"}

          </p>

        </div>

      </div>

    );

  }



  // ========== INTERFACE: APP PRINCIPAL ==========

  return (

    <div style={{ padding: "15px", fontFamily: "sans-serif", maxWidth: "500px", margin: "auto", minHeight: "100vh", backgroundColor: "#fff" }}>

      {/* HEADER COM LOGO E BOTÃO DE SAIR */}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", paddingBottom: "15px", borderBottom: "2px solid #d81b60" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

          {logoUrl && <img src={logoUrl} alt="Logo" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />}

          <div>

            <h1 style={{ color: "#d81b60", margin: 0, fontSize: "18px" }}>{nomeEmpresa || "Pragendar R$"}</h1>

            <small style={{ color: "#999", display: "block" }}>v2.0 - Premium</small>

          </div>

        </div>

        <button onClick={() => signOut(auth)} style={{ padding: "8px 15px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>

          Sair

        </button>

      </div>

      

      {/* TABS PRINCIPAIS */}

      <div style={{ display: "flex", gap: "5px", marginBottom: "15px", overflowX: "auto", paddingBottom: "5px" }}>

        <button onClick={() => setTab("agenda")} style={btnTab(tab === "agenda")}>Agenda</button>

        <button onClick={() => setTab("financeiro")} style={btnTab(tab === "financeiro")}>Financeiro</button>

        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>

        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>

        <button onClick={() => setTab("estoque")} style={btnTab(tab === "estoque")}>Estoque</button>

        <button onClick={() => setTab("perfil")} style={btnTab(tab === "perfil")}>Perfil</button>

        <button onClick={() => setTab("retornos")} style={btnTab(tab === "retornos")}>Retornos</button>

      </div>



      {/* === ABA AGENDA COM CALENDÁRIO E TIMELINE === */}

      {tab === "agenda" && (

        <div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>

            <button onClick={() => setViewMonth(v => (v - 1 + 12) % 12)} style={btnMini}>{"<"}</button>

            <strong>{nomeMeses[viewMonth]} {viewYear}</strong>

            <button onClick={() => setViewMonth(v => (v + 1) % 12)} style={btnMini}>{" >"}</button>

          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "15px" }}>

            {["D","S","T","Q","Q","S","S"].map(d => <div key={d} style={{textAlign:"center", fontSize:"10px", fontWeight:"bold", padding: "5px 0"}}>{d}</div>)}

            {Array(new Date(viewYear, viewMonth, 1).getDay()).fill(null).map((_, i) => <div key={i}></div>)}

            {Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, i) => i + 1).map(dia => (

              <div key={dia} onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))}

                style={{ padding: "8px 0", textAlign: "center", borderRadius: "5px", cursor: "pointer", border: "1px solid #eee",

                backgroundColor: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? "#d81b60" : "#fff",

                color: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? "#fff" : "#333", fontSize: "12px", fontWeight: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? "bold" : "normal" }}>

                {dia}

              </div>

            ))}

          </div>



          <h3 style={{borderBottom: "2px solid #d81b60", paddingBottom: "10px"}}>Dia {selectedDate.toLocaleDateString("pt-BR")}</h3>

          

          {(() => {

            const horaInicio = parseInt(horarioAbertura.split(":")[0]) || 8;

            const horaFim = parseInt(horarioFechamento.split(":")[0]) || 19;

            const totalHoras = horaFim - horaInicio + 1;

            const diaSemana = selectedDate.getDay();

            const configHoje = gradeHorarios[diaSemana];



            if (!configHoje?.aberta) {

              return <div style={{textAlign: "center", padding: "40px", color: "#999", backgroundColor: "#f5f5f5", borderRadius: "8px", marginTop: "20px"}}>😴 Estamos fechados hoje. Volte em outro dia!</div>;

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

                <div key={hora} style={{ ...itemStyle, borderLeft: app?.status === "pago" ? "5px solid #4caf50" : (app ? "5px solid #ff9800" : "1px solid #eee"), backgroundColor: app ? "#fffbf0" : "#fff" }}>

                  <div style={{ width: "50px", fontWeight: "bold", color: "#d81b60" }}>{String(hora).padStart(2, "0")}:00</div>

                  <div style={{ flex: 1 }}>

                    {app ? (

                      <div onClick={() => {setSelHora(hora); setEditAppId(app.id); setSelCliente(app.clientId); setSelServico(app.serviceId); setClientSearch(getNome(clients, app.clientId)); setShowModal(true);}} style={{cursor:"pointer", opacity: isStart ? 1 : 0.6}}>

                        <strong>{getNome(clients, app.clientId)}</strong> {isStart && `- ${getNome(services, app.serviceId)}`}

                      </div>

                    ) : (

                      ehPassado ? 

                      <span style={{color:"#ccc", cursor:"not-allowed"}}>Indisponível</span> :

                      <span onClick={() => {setSelHora(hora); setEditAppId(null); setSelCliente(""); setClientSearch(""); setShowModal(true);}} style={{color: "#4caf50", cursor:"pointer", fontWeight: "bold"}}>+ Disponível</span>

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

      )}



      {/* === ABA FINANCEIRO (COM GRÁFICO) === */}

      {tab === "financeiro" && (

        <div>

          {(() => {

            const chart = getChartData();

            return (

              <div style={cardStyle}>

                <h3>📊 Resumo do Mês</h3>

                <p style={{fontSize:"12px", fontWeight:"bold", marginBottom:"10px"}}>Total: R$ {chart.total}</p>

                

                <div style={{marginBottom:"15px"}}>

                  <div style={{marginBottom:"8px"}}>

                    <small style={{color:"#666"}}>💵 Dinheiro: R$ {chart.valores.dinheiro.toFixed(2)} ({chart.dinheiro}%)</small>

                    <div style={{width:"100%", height:"10px", backgroundColor:"#eee", borderRadius:"5px", overflow:"hidden"}}>

                      <div style={{width:`${chart.dinheiro}%`, height:"100%", backgroundColor:"#4caf50"}}></div>

                    </div>

                  </div>

                  <div style={{marginBottom:"8px"}}>

                    <small style={{color:"#666"}}>💳 Cartão: R$ {chart.valores.cartao.toFixed(2)} ({chart.cartao}%)</small>

                    <div style={{width:"100%", height:"10px", backgroundColor:"#eee", borderRadius:"5px", overflow:"hidden"}}>

                      <div style={{width:`${chart.cartao}%`, height:"100%", backgroundColor:"#2196f3"}}></div>

                    </div>

                  </div>

                  <div>

                    <small style={{color:"#666"}}>📲 Pix: R$ {chart.valores.pix.toFixed(2)} ({chart.pix}%)</small>

                    <div style={{width:"100%", height:"10px", backgroundColor:"#eee", borderRadius:"5px", overflow:"hidden"}}>

                      <div style={{width:`${chart.pix}%`, height:"100%", backgroundColor:"#9c27b0"}}></div>

                    </div>

                  </div>

                </div>

              </div>

            );

          })()}



          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>

            <div style={{ ...cardStyle, backgroundColor: "#e8f5e9" }}>Hoje: <strong>R$ {calcTotal(transactions, "hoje")}</strong></div>

            <div style={{ ...cardStyle, backgroundColor: "#f3e5f5" }}>Mês: <strong>R$ {calcTotal(transactions, "mes")}</strong></div>

          </div>

          <section style={cardStyle}>

            <h3>{editId ? "Editar Lançamento" : "Novo Lançamento Manual"}</h3>

            <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={inputStyle}>

              <option value="receita">Receita (Entrada)</option>

              <option value="despesa">Despesa (Saída)</option>

            </select>

            <label style={labelStyle}>Data do Lançamento</label>

            <input type="date" value={dataManualFin} onChange={e => setDataManualFin(e.target.value)} style={inputStyle} />

            <input placeholder="Descrição" value={descFin} onChange={e => setDescFin(e.target.value)} style={inputStyle} />

            <input placeholder="Valor R$" type="number" step="0.01" value={valorFin} onChange={e => setValorFin(e.target.value)} style={inputStyle} />

            

            <label style={{ fontSize: "12px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>Forma de Pagamento</label>

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

            <button onClick={handleSaveTransaction} style={{...btnStyle, backgroundColor: tipoFin==="receita"?"#4caf50":"#f44336"}}>{editId ? "Salvar Alteração" : "Gravar"}</button>

            {editId && <button onClick={() => {setEditId(null); setDescFin(""); setValorFin("");}} style={{...btnStyle, backgroundColor:"#ccc", color:"#333", marginTop:"5px"}}>Cancelar</button>}

          </section>

          <h3>Extrato Detalhado ({transactions.length} transações)</h3>

          {transactions.length === 0 ? (

            <div style={{...cardStyle, textAlign: "center", color: "#999"}}>Nenhuma transação registrada</div>

          ) : (

            transactions.sort((a,b) => b.data.localeCompare(a.data)).map(t => (

              <div key={t.id} style={itemStyle}>

                <span style={{flex:1}}>

                  <small>{new Date(t.data).toLocaleDateString("pt-BR")}</small><br/>

                  {t.descricao}

                  <br/>

                  <small style={{color:"#999"}}>

                    {t.formaPagamento === "dinheiro" && "💵 Dinheiro"}

                    {t.formaPagamento === "cartao" && "💳 Cartão"}

                    {t.formaPagamento === "pix" && "📲 Pix"}

                  </small>

                </span>

                <strong style={{color: t.tipo==="receita"?"green":"red", marginRight:"10px"}}>{t.tipo==="receita"?"+":"-"} R${t.valor.toFixed(2)}</strong>

                <button onClick={() => {setEditId(t.id); setDescFin(t.descricao); setValorFin(t.valor); setTipoFin(t.tipo); setFormaPagamento(t.formaPagamento || "dinheiro")}} style={btnEdit}>✏️</button>

                <button onClick={() => deleteWithConfirm("transactions", t.id, t.descricao)} style={btnDel}>🗑️</button>

              </div>

            ))

          )}

        </div>

      )}



      {/* === ABA CLIENTES (BUSCA A-Z + CSV + HISTÓRICO) === */}

      {tab === "clientes" && (

        <div>

          <section style={cardStyle}>

            <h3>{editId ? "Editar" : "Novo"} Cliente</h3>

            <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />

            <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />

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

            }} style={btnStyle}>Salvar Cliente</button>

          </section>



          <section style={cardStyle}>

            <h3>📥 Importar Clientes via CSV</h3>

            <p style={{fontSize:"12px", color:"#666", marginBottom:"10px"}}>

              ✅ Formato: Nome,Telefone - Sem limite de contatos!

            </p>

            <input 

              type="file" 

              accept=".csv"

              onChange={handleCSVImport}

              disabled={importingCSV}

              style={inputStyle}

            />

            {importingCSV && <p style={{fontSize:"12px", color:"#2196f3"}}>⏳ Importando...</p>}

          </section>



          <input placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", marginBottom: "10px" }}>

            {alfabeto.map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={btnLetter(selectedLetter === l)}>{l}</button>)}

            <button onClick={() => setSelectedLetter("")} style={btnLetter(selectedLetter === "")}>Tudo</button>

          </div>

          <p style={{fontSize: "12px", color: "#999"}}>Total: {clients.filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || c.nome?.toUpperCase().startsWith(selectedLetter))).length} clientes</p>

          {clients.filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || c.nome?.toUpperCase().startsWith(selectedLetter))).map(c => {

            const fidelity = getClientFidelity(c.id);

            return (

              <div key={c.id} style={{...itemStyle, borderLeft: fidelity.achieved ? "4px solid #ff9800" : "1px solid #eee"}}>

                <span style={{flex:1, cursor:"pointer"}} onClick={() => {setSelectedClientForHistory(c); setShowClientHistoryModal(true);}}>

                  <strong>{c.nome}</strong>

                  <br/><small>{c.telefone}</small>

                  {fidelity.achieved && <br/>}

                  {fidelity.achieved && <small style={{color:"#ff9800", fontWeight:"bold"}}>🎁 Prêmio!</small>}

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

          <section style={cardStyle}>

            <h3>{editId ? "Editar Serviço" : "Novo Serviço"}</h3>

            

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



            <label style={labelStyle}>Tempo de Duração</label>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>

              <div style={{flex: 1}}>

                <small>Horas</small>

                <input type="number" value={tempoHoras} onChange={e => setTempoHoras(Number(e.target.value))} style={inputStyle} />

              </div>

              <div style={{flex: 1}}>

                <small>Minutos</small>

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

            }} style={btnStyle}>

              {editId ? "Salvar Alterações" : "Cadastrar Serviço"}

            </button>

            {editId && <button onClick={() => {setEditId(null); setNomeServico(""); setPreco(""); setDescServico(""); setTempoHoras(0); setTempoMinutos(30);}} style={{...btnStyle, backgroundColor:"#ccc", color:"#333", marginTop:"5px"}}>Cancelar</button>}

          </section>



          <h3>Serviços Cadastrados ({services.length})</h3>

          {services.length === 0 ? (

            <div style={{...cardStyle, textAlign: "center", color: "#999"}}>Nenhum serviço cadastrado</div>

          ) : (

            services.map(s => (

              <div key={s.id} style={itemStyle}>

                <span style={{flex:1}}>

                  <strong>{s.nome}</strong><br/>

                  <small>R${s.preco.toFixed(2)} - {s.duracao >= 60 ? `${Math.floor(s.duracao/60)}h ${s.duracao%60}min` : `${s.duracao}min`}</small>

                  {s.descricao && <><br/><small style={{color: "#666", fontStyle: "italic"}}>{s.descricao}</small></>}

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

          <section style={cardStyle}>

            <h3>{editProductId ? "Editar Produto" : "Novo Produto"}</h3>

            <input placeholder="Nome do Produto" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} style={inputStyle} />

            <input placeholder="Quantidade" type="number" value={qtdProduto} onChange={e => setQtdProduto(e.target.value)} style={inputStyle} />

            <input placeholder="Alerta Crítico (mín)" type="number" value={alerta} onChange={e => setAlerta(e.target.value)} style={inputStyle} />

            <button onClick={handleSaveProduct} style={btnStyle}>{editProductId ? "Atualizar" : "Adicionar"}</button>

            {editProductId && <button onClick={() => {setEditProductId(null); setNomeProduto(""); setQtdProduto(""); setAlerta("");}} style={{...btnStyle, backgroundColor:"#ccc", color:"#333", marginTop:"5px"}}>Cancelar</button>}

          </section>

          <h3>Inventário ({inventory.length})</h3>

          {inventory.length === 0 ? (

            <div style={{...cardStyle, textAlign: "center", color: "#999"}}>Nenhum produto cadastrado</div>

          ) : (

            inventory.map(prod => {

              const critico = Number(prod.quantidade) <= Number(prod.alertaCritico);

              return (

                <div key={prod.id} style={{...itemStyle, borderLeft: critico ? "4px solid #f44336" : "1px solid #eee", backgroundColor: critico ? "#ffebee" : "#fff"}}>

                  <span style={{flex:1}}>

                    <strong>{prod.nome}</strong><br/>

                    <small>{prod.quantidade} un. {critico && <span style={{color:"#f44336", fontWeight:"bold"}}>⚠️ CRÍTICO</span>}</small>

                  </span>

                  <button onClick={() => {setEditProductId(prod.id); setNomeProduto(prod.nome); setQtdProduto(prod.quantidade); setAlerta(prod.alertaCritico);}} style={btnEdit}>✏️</button>

                  <button onClick={() => deleteWithConfirm("inventory", prod.id, prod.nome)} style={btnDel}>🗑️</button>

                </div>

              );

            })

          )}

        </div>

      )}



      {/* === ABA PERFIL === */}

      {tab === "perfil" && (

        <div>

          <section style={cardStyle}>

            <h3>Perfil da Profissional</h3>

            {!editingProfile ? (

              <div>

                <div style={{ marginBottom: "15px", textAlign: "center" }}>

                  {logoUrl ? (

                    <img src={logoUrl} alt="Logo" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", marginBottom: "10px" }} />

                  ) : (

                    <div style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "#eee", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>

                      <span style={{ fontSize: "12px", color: "#999" }}>📷 Sem Logo</span>

                    </div>

                  )}

                  <p style={{ margin: "5px 0" }}><strong>{nomeEmpresa || "Seu Salão"}</strong></p>

                  <p style={{ margin: "5px 0", fontSize: "12px", color: "#666" }}>{telefoneProfissional || "Telefone não definido"}</p>

                  <p style={{ margin: "5px 0", fontSize: "12px", color: "#666" }}>

                    🕐 {horarioAbertura} às {horarioFechamento}

                  </p>

                  <p style={{ margin: "5px 0", fontSize: "12px", color: "#666" }}>

                    🎁 Fidelidade: A cada {fidelidadeLimit} atendimentos

                  </p>

                </div>

                <button onClick={() => setEditingProfile(true)} style={{...btnStyle, backgroundColor: "#2196f3"}}>✏️ Editar Perfil</button>

                <button onClick={printReport} style={{...btnStyle, backgroundColor: "#ff9800", marginTop:"5px"}}>🖨️ Imprimir Relatório</button>

              </div>

            ) : (

              <div>

                <input 

                  placeholder="Nome da Empresa/Salão" 

                  value={nomeEmpresa} 

                  onChange={e => setNomeEmpresa(e.target.value)} 

                  style={inputStyle} 

                />

                

                <label style={labelStyle}>📷 Logo do Salão</label>

                <input 

                  type="file" 

                  accept="image/*" 

                  onChange={handleFileUpload}

                  disabled={uploadingLogo}

                  style={inputStyle} 

                />

                {uploadingLogo && <p style={{fontSize:"12px", color:"#2196f3"}}>⏳ Enviando...</p>}

                {logoUrl && (

                  <div style={{ textAlign: "center", marginBottom: "10px" }}>

                    <img src={logoUrl} alt="Preview" style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover" }} />

                    <p style={{ fontSize: "11px", color: "#4caf50", margin: "5px 0 0 0" }}>✅ Logo atualizado</p>

                  </div>

                )}



                <input 

                  placeholder="Telefone de Contato" 

                  value={telefoneProfissional} 

                  onChange={e => setTelefoneProfissional(e.target.value)} 

                  style={inputStyle} 

                />

                <label style={labelStyle}>🕐 Horário de Abertura</label>

                <input                                                                                                                                                              <input 

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

                    <div key={index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px", border: "1px solid #eee", borderRadius: "5px" }}>

                      <span style={{fontSize: "12px", fontWeight: "bold"}}>{nome}</span>

                      <div style={{ display: "flex", gap: "5px" }}>

                        <button onClick={() => setGradeHorarios({...gradeHorarios, [index]: {...gradeHorarios[index], aberta: !gradeHorarios[index].aberta}})}

                          style={{ padding: "4px 8px", fontSize: "10px", backgroundColor: gradeHorarios[index].aberta ? "#4caf50" : "#ccc", color: "white", border: "none", borderRadius: "3px", cursor: "pointer" }}>

                          {gradeHorarios[index].aberta ? "ABERTO" : "FECHADO"}

                        </button>

                        {gradeHorarios[index].aberta && (

                          <select value={gradeHorarios[index].tipo || "janela"} onChange={(e) => setGradeHorarios({...gradeHorarios, [index]: {...gradeHorarios[index], tipo: e.target.value, horas: e.target.value === "fixo" ? [7,9] : []}})} style={{fontSize: "10px", padding: "4px", borderRadius: "3px", border: "1px solid #ccc"}}>

                            <option value="janela">Normal</option>

                            <option value="fixo">7h e 9h</option>

                          </select>

                        )}

                      </div>

                    </div>

                  ))}

                </div>

                <button onClick={handleSaveProfile} style={{...btnStyle, backgroundColor: "#4caf50"}}>💾 Salvar Alterações</button>

                <button onClick={() => setEditingProfile(false)} style={{...btnStyle, backgroundColor: "#ccc", color: "#333", marginTop: "5px"}}>❌ Cancelar</button>

              </div>

            )}

          </section>

        </div>

      )}



      {/* === ABA RETORNOS === */}

      {tab === "retornos" && (

        <div>

          <h3 style={{borderBottom: "2px solid #d81b60", paddingBottom: "10px"}}>🔄 Sugestão de Retorno (30 dias)</h3>

          <p style={{fontSize: "12px", color: "#666", marginBottom: "15px"}}>Clientes que completam 30 dias desde o último atendimento.</p>

          {clients.length === 0 ? (

            <div style={{...cardStyle, textAlign: "center", color: "#999"}}>Nenhuma cliente cadastrada</div>

          ) : (

            clients.map(cli => {

              const history = getClientHistory(cli.id);

              if (history.count === 0) return null;

              const ultimaData = new Date(history.apps[0].dataHora);

              const dataRetorno = new Date(ultimaData);

              dataRetorno.setDate(dataRetorno.getDate() + 30);

              

              return (

                <div key={cli.id} style={itemStyle}>

                  <span style={{flex: 1}}>

                    <strong>{cli.nome}</strong><br/>

                    <small>Último atendimento: {ultimaData.toLocaleDateString("pt-BR")}</small><br/>

                    <small style={{color: "#d81b60", fontWeight: "bold"}}>Próximo retorno: {dataRetorno.toLocaleDateString("pt-BR")}</small>

                  </span>

                  <button onClick={() => {

                    setSelectedDate(dataRetorno);

                    setTab("agenda");

                  }} style={{...btnStyle, width: "auto", padding: "5px 10px", fontSize: "11px"}}>Agendar</button>

                </div>

              );

            }).filter(item => item !== null)

          )}

        </div>

      )}



      {/* === MODAL DE AGENDAMENTO === */}

      {showModal && (

        <div style={modalOverlay}>

          <div style={modalContent}>

            <h3>{editAppId ? "Editar" : "Novo"} Agendamento {String(selHora).padStart(2, "0")}:00</h3>

            <div style={{position:"relative"}}>

              <input placeholder="🔍 Nome da cliente..." value={clientSearch} onChange={e => {setClientSearch(e.target.value); setSelCliente("");}} style={inputStyle} />

              {clientSearch && !selCliente && (

                <div style={dropdownStyle}>

                  {clients.filter(c => c.nome.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 5).map(c => (

                    <div key={c.id} onClick={() => {setSelCliente(c.id); setClientSearch(c.nome)}} style={dropdownItem}>

                      {c.nome} <small>({c.telefone})</small>

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

            }} style={btnStyle}>✅ Confirmar</button>

            <button onClick={() => setShowModal(false)} style={{...btnStyle, backgroundColor:"#ccc", color: "#333", marginTop:"5px"}}>❌ Cancelar</button>

          </div>

        </div>

      )}



      {/* === MODAL DE PAGAMENTO === */}

      {showPaymentModal && selectedAppForPayment && (

        <div style={modalOverlay}>

          <div style={modalContent}>

            <h3>💳 Confirmar Pagamento</h3>

            <div style={{textAlign:"center", marginBottom:"15px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "8px"}}>

              <p style={{margin:"5px 0"}}><strong>{getNome(clients, selectedAppForPayment.clientId)}</strong></p>

              <p style={{margin:"5px 0", fontSize:"12px", color:"#666"}}>

                {getNome(services, selectedAppForPayment.serviceId)} - R${services.find(s => s.id === selectedAppForPayment.serviceId)?.preco.toFixed(2) || "0.00"}

              </p>

            </div>

            

            <label style={labelStyle}>Forma de Pagamento</label>

            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={inputStyle}>

              <option value="dinheiro">💵 Dinheiro</option>

              <option value="cartao">💳 Cartão</option>

              <option value="pix">📲 Pix</option>

            </select>



            <button onClick={confirmPayment} style={{...btnStyle, backgroundColor: "#4caf50"}}>✅ Receber Pagamento</button>

            <button onClick={() => setShowPaymentModal(false)} style={{...btnStyle, backgroundColor: "#ccc", color: "#333", marginTop: "5px"}}>❌ Cancelar</button>

          </div>

        </div>

      )}



      {/* === MODAL DE HISTÓRICO DA CLIENTE === */}

      {showClientHistoryModal && selectedClientForHistory && (() => {

        const history = getClientHistory(selectedClientForHistory.id);

        const fidelity = getClientFidelity(selectedClientForHistory.id);

        return (

          <div style={modalOverlay}>

            <div style={{...modalContent, maxHeight:"80vh", overflowY:"auto"}}>

              <h3>📂 Histórico de {selectedClientForHistory.nome}</h3>

              <p style={{fontSize:"12px", color:"#666"}}>

                📞 {selectedClientForHistory.telefone}

              </p>

              

              <div style={{...cardStyle, backgroundColor:"#f5f5f5"}}>

                <p style={{margin:"5px 0"}}><strong>Total Gasto:</strong> <span style={{color: "#d81b60", fontSize: "14px", fontWeight: "bold"}}>R$ {history.totalGasto.toFixed(2)}</span></p>

                <p style={{margin:"5px 0"}}><strong>Atendimentos:</strong> {history.count}</p>

                <p style={{margin:"5px 0", color: fidelity.achieved ? "#ff9800" : "#999"}}>

                  <strong>Fidelidade:</strong> {fidelity.count}/{fidelity.limit} {fidelity.achieved && "🎁 Prêmio atingido!"}

                </p>

              </div>



              <h4 style={{marginTop: "15px", marginBottom: "10px"}}>Agendamentos Registrados:</h4>

              {history.apps.length > 0 ? history.apps.map(a => {

                const serv = services.find(s => s.id === a.serviceId);

                return (

                  <div key={a.id} style={{...itemStyle, fontSize:"12px"}}>

                    <span style={{flex:1}}>

                      {new Date(a.dataHora).toLocaleDateString("pt-BR")} às {String(new Date(a.dataHora).getHours()).padStart(2, "0")}:00<br/>

                      <strong>{serv?.nome}</strong><br/>

                      Status: <strong style={{color: a.status === "pago" ? "#4caf50" : "#ff9800"}}>{a.status === "pago" ? "✅ Pago" : "⏳ Pendente"}</strong>

                    </span>

                    <strong style={{color:"green"}}>R$ {serv?.preco.toFixed(2)}</strong>

                  </div>

                );

              }) : <p style={{fontSize:"12px", color:"#999", textAlign: "center", padding: "10px"}}>Nenhum agendamento registrado</p>}



              <button onClick={() => setShowClientHistoryModal(false)} style={{...btnStyle, backgroundColor:"#ccc", color:"#333", marginTop:"10px"}}>Fechar</button>

            </div>

          </div>

        );

      })()}

    </div>

  );

}



// ========== AUXILIARES E ESTILOS CENTRALIZADOS ==========

const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];



const calcTotal = (list, p) => {

  const h = new Date().toLocaleDateString("pt-BR");

  const m = new Date().getMonth();

  return list.filter(t => {

    const d = new Date(t.data);

    return (p === "hoje" ? d.toLocaleDateString("pt-BR") === h : d.getMonth() === m) && t.tipo === "receita";

  }).reduce((acc, c) => acc + c.valor, 0);

};



const btnTab = (active) => ({ flex: 1, padding: "10px", backgroundColor: active ? "#d81b60" : "#eee", color: active ? "white" : "black", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontWeight: active ? "bold" : "normal" });

const btnMini = { padding: "5px 15px", backgroundColor: "#eee", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "12px" };

const inputStyle = { width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box", fontSize: "14px" };

const labelStyle = { fontSize: "12px", fontWeight: "bold", display: "block", marginBottom: "5px" };

const btnStyle = { width: "100%", padding: "12px", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", backgroundColor: "#d81b60", fontSize: "14px" };

const itemStyle = { display: "flex", alignItems: "center", padding: "10px", borderBottom: "1px solid #eee", fontSize: "13px", backgroundColor: "#fff" };

const cardStyle = { padding: "15px", borderRadius: "10px", marginBottom: "15px", border: "1px solid #eee", backgroundColor: "#fff" };

const modalOverlay = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };

const modalContent = { backgroundColor: "#fff", padding: "20px", borderRadius: "15px", width: "90%", maxWidth: "350px" };

const dropdownStyle = { position: "absolute", top: "45px", left: 0, width: "100%", backgroundColor: "#fff", border: "1px solid #ccc", zIndex: 10, maxHeight: "150px", overflowY: "auto", borderRadius: "5px" };

const dropdownItem = { padding: "10px", cursor: "pointer", borderBottom: "1px solid #eee", fontSize: "13px" };

const btnPay = { backgroundColor: "#4caf50", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 10px", marginLeft: "5px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" };

const btnWhatsApp = { backgroundColor: "#25D366", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 10px", marginLeft: "5px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" };

const btnDel = { backgroundColor: "#ffcdd2", color: "#c62828", border: "none", borderRadius: "5px", padding: "5px 10px", marginLeft: "5px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" };

const btnEdit = { backgroundColor: "#e1f5fe", color: "#0277bd", border: "none", borderRadius: "5px", padding: "5px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" };

const btnLetter = (active) => ({ padding: "3px", minWidth: "22px", fontSize: "10px", backgroundColor: active ? "#d81b60" : "#f0f0f0", color: active ? "white" : "#333", border: "1px solid #ddd", borderRadius: "3px", cursor: "pointer" });
