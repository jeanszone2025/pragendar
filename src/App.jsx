import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, setDoc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [authTab, setAuthTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [profile, setProfile] = useState(null);

  // --- ESTADOS DE INTERFACE E CALENDÁRIO ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // --- ESTADOS DE MODAL E EDIÇÃO ---
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

  // --- ESTADOS DE FORMULÁRIOS ---
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descFin, setDescFin] = useState("");
  const [valorFin, setValorFin] = useState("");
  const [tipoFin, setTipoFin] = useState("receita");
  const [formaPagamento, setFormaPagamento] = useState("pix");

  // --- ESTADOS DO PERFIL ---
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [telefoneProfissional, setTelefoneProfissional] = useState("");
  const [horarioAbertura, setHorarioAbertura] = useState("09:00");
  const [horarioFechamento, setHorarioFechamento] = useState("19:00");
  const [fidelidadeLimit, setFidelidadeLimit] = useState(10);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // --- ESTADOS CSV E LOADING ---
  const [importingCSV, setImportingCSV] = useState(false);

  // --- ESTADOS ESTOQUE ---
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

  // ========== CARREGAR DADOS COM UID ==========
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
      alert("✅ Logo carregada!");
    } catch (error) {
      alert("❌ Erro: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // ========== FIX 1: IMPORTAÇÃO CSV COM WRITEBATCH (ULTRARRÁPIDO) ==========
  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setImportingCSV(true);
    const batch = writeBatch(db);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let content = event.target.result;

        // Remove BOM (Byte Order Mark)
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }

        // Normaliza quebras de linha
        const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; 

          const [nome, telefone] = line.split(',').map(item => item?.trim());

          if (nome) {
            const newRef = doc(collection(db, "clients"));
            batch.set(newRef, {
              nome,
              telefone: telefone || "", 
              tenantId: user.uid,
              createdAt: serverTimestamp()
            });
            count++;
          }

          if (count >= 500) break; // Limite do Firebase Batch
        }

        if (count > 0) {
          await batch.commit();
          alert(`✅ ${count} contatos importados!`);
        } else {
          alert("⚠️ Nenhuma linha válida encontrada.");
        }
        
        loadData(user.uid);
      } catch (error) {
        console.error("Erro:", error);
        alert("❌ Erro ao importar CSV");
      } finally {
        setImportingCSV(false);
        e.target.value = "";
      }
    };

    reader.readAsText(file, 'UTF-8');
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
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setEditingProfile(false);
      loadProfile(user.uid);
      alert("✅ Perfil salvo!");
    } catch (error) {
      alert("❌ Erro: " + error.message);
    }
  };

  // --- LÓGICA DE BLOQUEIO DE HORÁRIOS ---
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

  // ========== DASHBOARD GRÁFICOS ==========
  const getChartData = () => {
    const dinheiro = transactions.filter(t => t.formaPagamento === 'dinheiro' && t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
    const cartao = transactions.filter(t => t.formaPagamento === 'cartao' && t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
    const pix = transactions.filter(t => t.formaPagamento === 'pix' && t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
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
    const clientTransactions = transactions.filter(t => t.appointmentId && appointments.find(a => a.id === t.appointmentId && a.clientId === clientId));
    const totalGasto = clientTransactions.reduce((acc, t) => acc + (t.tipo === 'receita' ? t.valor : 0), 0);
    
    return {
      apps: clientApps,
      totalGasto,
      count: clientApps.length
    };
  };

  // ========== FIDELIDADE ==========
  const getClientFidelity = (clientId) => {
    const paidApps = appointments.filter(a => a.clientId === clientId && a.status === 'pago');
    const count = paidApps.length;
    const achieved = count >= fidelidadeLimit;
    return { count, achieved, limit: fidelidadeLimit };
  };

  // ========== CONTROLE DE ESTOQUE ==========
  const handleSaveProduct = async () => {
    if (!nomeProduto.trim() || !qtdProduto || !alerta) return alert("Preencha todos");
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

  // ========== PAGAMENTO ==========
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
      alert("❌ Erro: " + error.message);
    }
  };

  // ========== WHATSAPP LEMBRETE ==========
  const sendWhatsAppReminder = (app) => {
    const cli = clients.find(c => c.id === app.clientId);
    const serv = services.find(s => s.id === app.serviceId);
    
    if (!cli || !cli.telefone) return alert("❌ Cliente sem telefone!");

    const dataFmt = new Date(app.dataHora).toLocaleDateString('pt-BR');
    const horaFmt = String(new Date(app.dataHora).getHours()).padStart(2, '0');
    const minFmt = String(new Date(app.dataHora).getMinutes()).padStart(2, '0');
    const nomeS = nomeEmpresa || "Pragendar R$";

    const mensagem = `Olá ${cli.nome}! ✨ Aqui é do ${nomeS}. Confirmar horário de *${serv?.nome}* em *${dataFmt}* às *${horaFmt}:${minFmt}h*? 🙏`;

    const foneLimpo = cli.telefone.replace(/\D/g, '');
    const link = `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(link, '_blank');
  };

  // ========== TRANSAÇÃO ==========
  const handleSaveTransaction = async () => {
    const d = { 
      descricao: descFin, 
      valor: Number(valorFin), 
      tipo: tipoFin, 
      data: new Date().toISOString(), 
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
      alert("❌ Erro: " + error.message);
    }
  };

  // --- AUXILIARES ---
  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";
  const getTel = (list, id) => list.find(i => i.id === id)?.telefone || "";

  const deleteWithConfirm = async (col, id, nome) => {
    if (window.confirm(`Excluir ${nome}?`)) {
      try {
        await deleteDoc(doc(db, col, id));
        loadData(user.uid);
      } catch (error) {
        alert("❌ Erro: " + error.message);
      }
    }
  };

  // ========== FIX 2: FUNÇÃO PARA GERAR RELATÓRIO E IMPRIMIR ==========
  const generateAndPrintReport = () => {
    const reportWindow = window.open('', 'relatório');
    const chart = getChartData();
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório ${nomeEmpresa}</title>
        <style>
          body { font-family: Arial, sans-serif; background: white; margin: 0; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; color: #d81b60; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
          .card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #d81b60; color: white; padding: 10px; text-align: left; }
          td { border: 1px solid #ddd; padding: 8px; }
          @media print {
            button { display: none; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${nomeEmpresa || 'Pragendar R$'}</h1>
          <p style="text-align: center;">Relatório de ${dataAtual}</p>
          
          <h2>Resumo Financeiro</h2>
          <div class="summary">
            <div class="card"><strong>💵 Dinheiro</strong><br/>R$ ${chart.valores.dinheiro.toFixed(2)} (${chart.dinheiro}%)</div>
            <div class="card"><strong>💳 Cartão</strong><br/>R$ ${chart.valores.cartao.toFixed(2)} (${chart.cartao}%)</div>
            <div class="card"><strong>📲 Pix</strong><br/>R$ ${chart.valores.pix.toFixed(2)} (${chart.pix}%)</div>
          </div>
          <h3 style="text-align: center;">Total: R$ ${chart.total}</h3>

          <h2>Agendamentos</h2>
          <table>
            <thead><tr><th>Data/Hora</th><th>Cliente</th><th>Serviço</th><th>Status</th></tr></thead>
            <tbody>
              ${appointments.map(a => `
                <tr>
                  <td>${new Date(a.dataHora).toLocaleDateString('pt-BR')} ${String(new Date(a.dataHora).getHours()).padStart(2, '0')}:00</td>
                  <td>${getNome(clients, a.clientId)}</td>
                  <td>${getNome(services, a.serviceId)}</td>
                  <td>${a.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>window.print();</script>
        </div>
      </body>
      </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  // ========== RENDERIZAÇÃO - LOGIN ==========
  if (!user) {
    return (
      <div style={{ padding: '40px 20px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' }}>
        <h1 style={{ color: '#d81b60', marginBottom: '30px' }}>Pragendar R$</h1>
        <div style={{ padding: '30px', borderRadius: '10px', backgroundColor: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', maxWidth: '350px' }}>
          <h3 style={{marginTop: 0}}>{authTab === "login" ? "Entrar" : "Criar Conta"}</h3>
          <form onSubmit={handleAuth}>
            <input 
              placeholder="E-mail" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              required
            />
            <input 
              placeholder="Senha" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              required
            />
            <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#d81b60', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              {authTab === "login" ? "Entrar" : "Cadastrar"}
            </button>
          </form>
          <p onClick={() => setAuthTab(authTab === "login" ? "cadastro" : "login")} style={{ cursor: 'pointer', color: '#d81b60', marginTop: '15px', fontSize: '14px' }}>
            {authTab === "login" ? "Novo por aqui? Cadastre-se" : "Já tem conta? Faça Login"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '15px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto', backgroundColor: '#fff', minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />}
          <h1 style={{ color: '#d81b60', margin: 0, fontSize: '18px' }}>{nomeEmpresa || "Pragendar R$"}</h1>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: '8px 15px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          Sair
        </button>
      </div>
      
      {/* TABS */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto' }}>
        {['agenda', 'financeiro', 'clientes', 'servicos', 'estoque', 'perfil'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', backgroundColor: tab === t ? '#d81b60' : '#eee', color: tab === t ? '#fff' : '#333', border: 'none', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontWeight: tab === t ? 'bold' : 'normal' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ABA AGENDA */}
      {tab === "agenda" && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button onClick={() => setViewMonth(v => (v - 1 + 12) % 12)} style={{ padding: '5px 10px', backgroundColor: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>←</button>
            <strong>{["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][viewMonth]} {viewYear}</strong>
            <button onClick={() => setViewMonth(v => (v + 1) % 12)} style={{ padding: '5px 10px', backgroundColor: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>→</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '15px' }}>
            {["D","S","T","Q","Q","S","S"].map(d => <div key={d} style={{textAlign:'center', fontSize:'10px', fontWeight:'bold'}}>{d}</div>)}
            {Array(new Date(viewYear, viewMonth, 1).getDay()).fill(null).map((_, i) => <div key={i}></div>)}
            {Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, i) => i + 1).map(dia => (
              <div key={dia} onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))} style={{ padding: '8px 0', textAlign: 'center', borderRadius: '5px', backgroundColor: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#d81b60' : '#fff', color: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#fff' : '#333', cursor: 'pointer', border: '1px solid #eee', fontSize: '13px' }}>
                {dia}
              </div>
            ))}
          </div>

          <h3 style={{borderBottom: '2px solid #d81b60', paddingBottom: '5px'}}>Dia {selectedDate.toLocaleDateString('pt-BR')}</h3>
          
          {(() => {
            const horaInicio = parseInt(horarioAbertura.split(':')[0]) || 8;
            const horaFim = parseInt(horarioFechamento.split(':')[0]) || 19;

            return Array.from({ length: horaFim - horaInicio + 1 }, (_, i) => i + horaInicio).map(hora => {
              const app = getAppDoHorario(hora);
              const isStart = app && new Date(app.dataHora).getHours() === hora;
              const isDomingo = selectedDate.getDay() === 0;
              return (
                <div key={hora} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px', borderLeft: app?.status === 'pago' ? '5px solid #4caf50' : (app ? '5px solid #ff9800' : '1px solid #eee') }}>
                  <div style={{ width: '50px', fontWeight: 'bold' }}>{String(hora).padStart(2, '0')}:00</div>
                  <div style={{ flex: 1 }}>
                    {isDomingo ? <span style={{color:'#999'}}>Fechado</span> : app ? (
                      <div onClick={() => {setSelHora(hora); setEditAppId(app.id); setSelCliente(app.clientId); setSelServico(app.serviceId); setClientSearch(getNome(clients, app.clientId)); setShowModal(true);}} style={{cursor:'pointer', opacity: isStart ? 1 : 0.6}}>
                        <strong>{getNome(clients, app.clientId)}</strong> {isStart && `- ${getNome(services, app.serviceId)}`}
                      </div>
                    ) : (
                      <span onClick={() => {setSelHora(hora); setEditAppId(null); setSelCliente(""); setClientSearch(""); setShowModal(true);}} style={{color: '#4caf50', cursor:'pointer'}}>+ Disponível</span>
                    )}
                  </div>
                  {isStart && app.status !== "pago" && (
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <button onClick={() => sendWhatsAppReminder(app)} style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer' }}>📱</button>
                      <button onClick={() => handlePaymentClick(app)} style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer' }}>💵</button>
                    </div>
                  )}
                  {isStart && <button onClick={() => deleteWithConfirm("appointments", app.id, getNome(clients, app.clientId))} style={{ backgroundColor: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer' }}>X</button>}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* ABA FINANCEIRO */}
      {tab === "financeiro" && (
        <div>
          {(() => {
            const chart = getChartData();
            return (
              <div style={{ padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', backgroundColor: '#fcfcfc' }}>
                <h3>📊 Resumo do Mês: R$ {chart.total}</h3>
                
                <div style={{marginBottom:'15px'}}>
                  <div style={{marginBottom:'8px'}}>
                    <small>💵 Dinheiro: R$ {chart.valores.dinheiro.toFixed(2)} ({chart.dinheiro}%)</small>
                    <div style={{width:'100%', height:'8px', backgroundColor:'#eee', borderRadius:'4px', overflow:'hidden'}}>
                      <div style={{width:`${chart.dinheiro}%`, height:'100%', backgroundColor:'#4caf50'}}></div>
                    </div>
                  </div>
                  <div style={{marginBottom:'8px'}}>
                    <small>💳 Cartão: R$ {chart.valores.cartao.toFixed(2)} ({chart.cartao}%)</small>
                    <div style={{width:'100%', height:'8px', backgroundColor:'#eee', borderRadius:'4px', overflow:'hidden'}}>
                      <div style={{width:`${chart.cartao}%`, height:'100%', backgroundColor:'#2196f3'}}></div>
                    </div>
                  </div>
                  <div>
                    <small>📲 Pix: R$ {chart.valores.pix.toFixed(2)} ({chart.pix}%)</small>
                    <div style={{width:'100%', height:'8px', backgroundColor:'#eee', borderRadius:'4px', overflow:'hidden'}}>
                      <div style={{width:`${chart.pix}%`, height:'100%', backgroundColor:'#9c27b0'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ padding: '15px', borderRadius: '10px', backgroundColor: '#e8f5e9', border: '1px solid #c8e6c9' }}>Hoje: <strong>R$ {calcTotal(transactions, "hoje")}</strong></div>
            <div style={{ padding: '15px', borderRadius: '10px', backgroundColor: '#f3e5f5', border: '1px solid #e1bee7' }}>Mês: <strong>R$ {calcTotal(transactions, "mes")}</strong></div>
          </div>
          <section style={{ padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', backgroundColor: '#fcfcfc' }}>
            <h3>{editId ? "Editar" : "Novo"} Lançamento</h3>
            <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
            <input placeholder="Descrição" value={descFin} onChange={e => setDescFin(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <input placeholder="Valor R$" type="number" value={valorFin} onChange={e => setValorFin(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Forma</label>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="cartao">💳 Cartão</option>
              <option value="pix">📲 Pix</option>
            </select>

            <button onClick={handleSaveTransaction} style={{ width: '100%', padding: '12px', backgroundColor: tipoFin==='receita'?'#4caf50':'#f44336', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              {editId ? "Salvar" : "Gravar"}
            </button>
            {editId && <button onClick={() => {setEditId(null); setDescFin(''); setValorFin('');}} style={{ width: '100%', padding: '10px', backgroundColor: '#ccc', color: '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '5px' }}>Cancelar</button>}
          </section>
          <h3>Extrato</h3>
          {transactions.sort((a,b) => b.data.localeCompare(a.data)).slice(0, 15).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '12px' }}>
              <span style={{flex:1}}>
                <small>{new Date(t.data).toLocaleDateString('pt-BR')}</small> - {t.descricao}<br/>
                <small>{t.formaPagamento === 'dinheiro' ? '💵' : t.formaPagamento === 'cartao' ? '💳' : '📲'}</small>
              </span>
              <strong style={{color: t.tipo==='receita'?'green':'red', marginRight:'8px'}}>{t.tipo==='receita'?'+':'-'} R${t.valor}</strong>
              <button onClick={() => {setEditId(t.id); setDescFin(t.descricao); setValorFin(t.valor); setTipoFin(t.tipo); setFormaPagamento(t.formaPagamento || 'dinheiro')}} style={{ backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer', marginRight: '3px' }}>✏️</button>
              <button onClick={() => deleteWithConfirm("transactions", t.id, t.descricao)} style={{ backgroundColor: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer' }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* ABA CLIENTES */}
      {tab === "clientes" && (
        <div>
          <section style={{ padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', backgroundColor: '#fcfcfc' }}>
            <h3>{editId ? "Editar" : "Novo"} Cliente</h3>
            <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <button onClick={async () => {
              if (!nomeCliente.trim()) return alert("Digite o nome");
              const d = { nome: nomeCliente, telefone, tenantId: user.uid };
              try {
                if(editId) await updateDoc(doc(db, "clients", editId), d);
                else await addDoc(collection(db, "clients"), d);
                setEditId(null); setNomeCliente(""); setTelefone(""); loadData(user.uid);
              } catch (error) {
                alert("❌ Erro: " + error.message);
              }
            }} style={{ width: '100%', padding: '12px', backgroundColor: '#d81b60', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              Salvar
            </button>
          </section>

          <section style={{ padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', backgroundColor: '#fcfcfc' }}>
            <h3>📥 Importar CSV</h3>
            <p style={{fontSize:'12px', color:'#666', marginBottom:'10px'}}>Formato: Nome,Telefone</p>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleCSVImport}
              disabled={importingCSV}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
            {importingCSV && <p style={{fontSize:'12px', color:'#2196f3'}}>⏳ Importando...</p>}
          </section>

          <input placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '10px' }}>
            {alfabeto.slice(0, 13).map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={{ padding: '3px', minWidth: '22px', fontSize: '10px', backgroundColor: selectedLetter === l ? '#d81b60' : '#f0f0f0', color: selectedLetter === l ? '#fff' : '#333', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' }}>{l}</button>)}
            <button onClick={() => setSelectedLetter("")} style={{ padding: '3px', minWidth: '22px', fontSize: '10px', backgroundColor: selectedLetter === "" ? '#d81b60' : '#f0f0f0', color: selectedLetter === "" ? '#fff' : '#333', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' }}>Tudo</button>
          </div>
          {clients.filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || c.nome?.toUpperCase().startsWith(selectedLetter))).slice(0, 40).map(c => {
            const fidelity = getClientFidelity(c.id);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px', borderLeft: fidelity.achieved ? '4px solid #ff9800' : '1px solid #eee' }}>
                <span style={{flex:1, cursor:'pointer'}} onClick={() => {setSelectedClientForHistory(c); setShowClientHistoryModal(true);}}>
                  <strong>{c.nome}</strong><br/><small>{c.telefone}</small>
                  {fidelity.achieved && <small style={{color:'#ff9800', fontWeight:'bold'}}> 🎁</small>}
                </span>
                <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome); setTelefone(c.telefone)}} style={{ backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer', marginRight: '3px' }}>✏️</button>
                <button onClick={() => deleteWithConfirm("clients", c.id, c.nome)} style={{ backgroundColor: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer' }}>🗑️</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ABA SERVIÇOS */}
      {tab === "servicos" && (
        <div>
          <section style={{ padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', backgroundColor: '#fcfcfc' }}>
            <h3>{editId ? "Editar" : "Novo"} Serviço</h3>
            <input placeholder="Nome" value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <input placeholder="Preço R$" type="number" value={preco} onChange={e => setPreco(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <input placeholder="Duração (min)" type="number" value={duracao} onChange={e => setDuracao(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <button onClick={async () => {
              if (!nomeServico.trim() || !preco || !duracao) return alert("Preencha tudo");
              const d = { nome: nomeServico, preco: Number(preco), duracao: Number(duracao), tenantId: user.uid };
              try {
                if(editId) await updateDoc(doc(db, "services", editId), d);
                else await addDoc(collection(db, "services"), d);
                setEditId(null); setNomeServico(""); setPreco(""); setDuracao(""); loadData(user.uid);
              } catch (error) {
                alert("❌ Erro: " + error.message);
              }
            }} style={{ width: '100%', padding: '12px', backgroundColor: '#d81b60', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              Salvar
            </button>
          </section>
          {services.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px' }}>
              <span style={{flex:1}}><strong>{s.nome}</strong><br/><small>R${s.preco} - {s.duracao}min</small></span>
              <button onClick={() => {setEditId(s.id); setNomeServico(s.nome); setPreco(s.preco); setDuracao(s.duracao)}} style={{ backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer', marginRight: '3px' }}>✏️</button>
              <button onClick={() => deleteWithConfirm("services", s.id, s.nome)} style={{ backgroundColor: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer' }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* ABA ESTOQUE */}
      {tab === "estoque" && (
        <div>
          <section style={{ padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', backgroundColor: '#fcfcfc' }}>
            <h3>{editProductId ? "Editar" : "Novo"} Produto</h3>
            <input placeholder="Nome" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <input placeholder="Quantidade" type="number" value={qtdProduto} onChange={e => setQtdProduto(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <input placeholder="Alerta" type="number" value={alerta} onChange={e => setAlerta(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
            <button onClick={handleSaveProduct} style={{ width: '100%', padding: '12px', backgroundColor: '#d81b60', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              {editProductId ? "Atualizar" : "Adicionar"}
            </button>
            {editProductId && <button onClick={() => {setEditProductId(null); setNomeProduto(''); setQtdProduto(''); setAlerta('');}} style={{ width: '100%', padding: '10px', backgroundColor: '#ccc', color: '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '5px' }}>Cancelar</button>}
          </section>
          <h3>Inventário</h3>
          {inventory.map(prod => {
            const critico = Number(prod.quantidade) <= Number(prod.alertaCritico);
            return (
              <div key={prod.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px', borderLeft: critico ? '4px solid #f44336' : '1px solid #eee', backgroundColor: critico ? '#ffebee' : '#fff' }}>
                <span style={{flex:1}}>
                  <strong>{prod.nome}</strong><br/>
                  <small>{prod.quantidade} un. {critico && <span style={{color:'#f44336', fontWeight:'bold'}}>⚠️</span>}</small>
                </span>
                <button onClick={() => {setEditProductId(prod.id); setNomeProduto(prod.nome); setQtdProduto(prod.quantidade); setAlerta(prod.alertaCritico);}} style={{ backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer', marginRight: '3px' }}>✏️</button>
                <button onClick={() => deleteWithConfirm("inventory", prod.id, prod.nome)} style={{ backgroundColor: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer' }}>🗑️</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ABA PERFIL */}
      {tab === "perfil" && (
        <div>
          <section style={{ padding: '15px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '15px', backgroundColor: '#fcfcfc' }}>
            <h3>Perfil</h3>
            {!editingProfile ? (
              <div>
                <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#eee', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#999' }}>📷</span>
                    </div>
                  )}
                  <p style={{ margin: '5px 0' }}><strong>{nomeEmpresa || "Seu Salão"}</strong></p>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>{telefoneProfissional || "Sem telefone"}</p>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>🕐 {horarioAbertura} às {horarioFechamento}</p>
                </div>
                <button onClick={() => setEditingProfile(true)} style={{ width: '100%', padding: '12px', backgroundColor: '#2196f3', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '5px' }}>
                  ✏️ Editar
                </button>
                <button onClick={generateAndPrintReport} style={{ width: '100%', padding: '12px', backgroundColor: '#ff9800', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🖨️ Imprimir
                </button>
              </div>
            ) : (
              <div>
                <input placeholder="Empresa" value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>📷 Logo</label>
                <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploadingLogo} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                {uploadingLogo && <p style={{fontSize:'12px', color:'#2196f3'}}>⏳ Enviando...</p>}
                {logoUrl && <p style={{ fontSize: '11px', color: '#4caf50', margin: '5px 0' }}>✅ OK</p>}

                <input placeholder="Telefone" value={telefoneProfissional} onChange={e => setTelefoneProfissional(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>🕐 Abertura</label>
                <input type="time" value={horarioAbertura} onChange={e => setHorarioAbertura(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>🕐 Fechamento</label>
                <input type="time" value={horarioFechamento} onChange={e => setHorarioFechamento(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px
