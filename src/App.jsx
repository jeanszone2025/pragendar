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
  // === ESTADOS DE AUTENTICAÇÃO ===
  const [user, setUser] = useState(null);
  const [authTab, setAuthTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // === ESTADOS DE DADOS ===
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [profile, setProfile] = useState(null);

  // === ESTADOS DE INTERFACE ===
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // === ESTADOS DE MODAL ===
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

  // === ESTADOS DE FORMULÁRIO ===
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descFin, setDescFin] = useState("");
  const [valorFin, setValorFin] = useState("");
  const [tipoFin, setTipoFin] = useState("receita");
  const [formaPagamento, setFormaPagamento] = useState("pix");

  // === ESTADOS DO PERFIL ===
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [telefoneProfissional, setTelefoneProfissional] = useState("");
  const [horarioAbertura, setHorarioAbertura] = useState("09:00");
  const [horarioFechamento, setHorarioFechamento] = useState("19:00");
  const [fidelidadeLimit, setFidelidadeLimit] = useState(10);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // === ESTADOS EXTRAS ===
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
      alert("Erro na autenticação: " + err.message);
    }
  };

  // ========== CARREGAR DADOS (FIRESTORE) ==========
  async function loadData(uid) {
    if (!uid) return;
    try {
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
    if (!uid) return;
    try {
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
      alert("❌ Erro no upload: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // ========== IMPORTAÇÃO CSV (MÚLTIPLOS BATCHES) ✨ CORRIGIDO ==========
  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setImportingCSV(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let content = event.target.result;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        
        let totalCount = 0;
        let batch = writeBatch(db);
        let batchCount = 0;

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
            
            batchCount++;
            totalCount++;

            // A CADA 500, FAZ COMMIT E CRIA NOVO BATCH
            if (batchCount === 500) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
              console.log(`✅ ${totalCount} contatos processados...`);
            }
          }
        }

        // COMMIT FINAL
        if (batchCount > 0) {
          await batch.commit();
        }

        if (totalCount > 0) {
          alert(`✅ ${totalCount} contatos importados com sucesso!`);
          loadData(user.uid);
        } else {
          alert("⚠️ Nenhuma linha válida encontrada.");
        }
      } catch (error) {
        console.error("Erro CSV:", error);
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
    if (!user) return;
    try {
      const docRef = doc(db, "profiles", user.uid);
      await setDoc(docRef, {
        nomeEmpresa, logoUrl, telefoneProfissional,
        horarioAbertura, horarioFechamento, fidelidadeLimit,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setEditingProfile(false);
      loadProfile(user.uid);
      alert("✅ Perfil salvo!");
    } catch (error) {
      alert("❌ Erro ao salvar perfil");
    }
  };

  // ========== DASHBOARD GRÁFICOS ==========
  const getChartData = () => {
    const receita = transactions.filter(t => t.tipo === 'receita');
    const dinheiro = receita.filter(t => t.formaPagamento === 'dinheiro').reduce((acc, t) => acc + t.valor, 0);
    const cartao = receita.filter(t => t.formaPagamento === 'cartao').reduce((acc, t) => acc + t.valor, 0);
    const pix = receita.filter(t => t.formaPagamento === 'pix').reduce((acc, t) => acc + t.valor, 0);
    const total = dinheiro + cartao + pix;

    return {
      dinheiro: total > 0 ? ((dinheiro / total) * 100).toFixed(1) : 0,
      cartao: total > 0 ? ((cartao / total) * 100).toFixed(1) : 0,
      pix: total > 0 ? ((pix / total) * 100).toFixed(1) : 0,
      total: total.toFixed(2),
      valores: { dinheiro, cartao, pix }
    };
  };

  // ========== FIDELIDADE E HISTÓRICO ==========
  const getClientFidelity = (clientId) => {
    const paidApps = appointments.filter(a => a.clientId === clientId && a.status === 'pago');
    return { count: paidApps.length, achieved: paidApps.length >= fidelidadeLimit };
  };

  const getClientHistory = (clientId) => {
    const clientApps = appointments.filter(a => a.clientId === clientId);
    const totalGasto = transactions
      .filter(t => t.appointmentId && clientApps.find(a => a.id === t.appointmentId))
      .reduce((acc, t) => acc + (t.tipo === 'receita' ? t.valor : 0), 0);
    return { apps: clientApps, totalGasto, count: clientApps.length };
  };

  // ========== CONTROLE DE ESTOQUE ==========
  const handleSaveProduct = async () => {
    if (!nomeProduto.trim() || !qtdProduto) return alert("Preencha nome e quantidade");
    try {
      const data = {
        nome: nomeProduto,
        quantidade: Number(qtdProduto),
        alertaCritico: Number(alerta || 0),
        updatedAt: new Date().toISOString()
      };
      if (editProductId) {
        await updateDoc(doc(db, "inventory", editProductId), data);
      } else {
        await addDoc(collection(db, "inventory"), { ...data, tenantId: user.uid });
      }
      setNomeProduto(""); setQtdProduto(""); setAlerta(""); setEditProductId(null);
      loadData(user.uid);
    } catch (error) {
      alert("❌ Erro no estoque");
    }
  };

  // ========== PAGAMENTO E WHATSAPP ==========
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
        formaPagamento
      });
      await updateDoc(doc(db, "appointments", selectedAppForPayment.id), { status: "pago" });
      setShowPaymentModal(false);
      loadData(user.uid);
      alert("✅ Recebido!");
    } catch (error) {
      alert("❌ Erro no pagamento");
    }
  };

  const sendWhatsAppReminder = (app) => {
    const cli = clients.find(c => c.id === app.clientId);
    const serv = services.find(s => s.id === app.serviceId);
    if (!cli?.telefone) return alert("❌ Sem telefone");
    const dataFmt = new Date(app.dataHora).toLocaleDateString('pt-BR');
    const horaFmt = String(new Date(app.dataHora).getHours()).padStart(2, '0');
    const msg = `Olá ${cli.nome}! ✨ Confirmando horário de *${serv?.nome}* dia *${dataFmt}* às *${horaFmt}:00h*?`;
    window.open(`https://wa.me/55${cli.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ========== SALVAR TRANSAÇÃO ==========
  const handleSaveTransaction = async () => {
    if (!descFin.trim() || !valorFin) return alert("Preencha descrição e valor");
    try {
      await addDoc(collection(db, "transactions"), {
        descricao: descFin,
        valor: Number(valorFin),
        tipo: tipoFin,
        data: new Date().toISOString(),
        tenantId: user.uid,
        formaPagamento
      });
      setDescFin(""); setValorFin(""); setFormaPagamento("pix");
      loadData(user.uid);
      alert("✅ Lançamento gravado!");
    } catch (error) {
      alert("❌ Erro ao gravar");
    }
  };

  // ========== IMPRESSÃO DE RELATÓRIO ==========
  const printReport = () => {
    const chart = getChartData();
    const win = window.open('', 'PRINT');
    win.document.write(`
      <html><head><title>Relatório</title><style>
        body { font-family: sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #d81b60; color: white; }
      </style></head><body>
      <h1>Relatório Financeiro - ${nomeEmpresa}</h1>
      <p>Total Recebido: <strong>R$ ${chart.total}</strong></p>
      <table>
        <tr><th>Forma</th><th>Valor</th><th>%</th></tr>
        <tr><td>Dinheiro</td><td>R$ ${chart.valores.dinheiro}</td><td>${chart.dinheiro}%</td></tr>
        <tr><td>Cartão</td><td>R$ ${chart.valores.cartao}</td><td>${chart.cartao}%</td></tr>
        <tr><td>Pix</td><td>R$ ${chart.valores.pix}</td><td>${chart.pix}%</td></tr>
      </table>
      <script>window.print(); window.close();</script></body></html>
    `);
    win.document.close();
  };

  // --- AUXILIARES DE AGENDA ---
  const getAppDoHorario = (hora) => {
    const dSel = new Date(selectedDate);
    return appointments.find(a => {
      const inicio = new Date(a.dataHora);
      const serv = services.find(s => s.id === a.serviceId);
      const dMin = serv ? Number(serv.duracao) : 60;
      const mesmaData = inicio.getDate() === dSel.getDate() && inicio.getMonth() === dSel.getMonth();
      if (!mesmaData) return false;
      const hInicio = inicio.getHours();
      const hFim = hInicio + (inicio.getMinutes() + dMin) / 60;
      return hora >= hInicio && hora < Math.ceil(hFim);
    });
  };

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";

  // ========== INTERFACE: LOGIN ==========
  if (!user) {
    return (
      <div style={styles.loginPage}>
        <h1 style={styles.mainTitle}>Pragendar R$</h1>
        <div style={styles.card}>
          <h3>{authTab === "login" ? "Entrar" : "Criar Conta"}</h3>
          <form onSubmit={handleAuth}>
            <input placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} required />
            <input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} style={styles.input} required />
            <button type="submit" style={styles.btnPrincipal}>{authTab === "login" ? "Entrar" : "Cadastrar"}</button>
          </form>
          <p onClick={() => setAuthTab(authTab === "login" ? "cad" : "login")} style={styles.toggleText}>
            {authTab === "login" ? "Novo por aqui? Cadastre-se" : "Já tem conta? Login"}
          </p>
        </div>
      </div>
    );
  }

  // ========== INTERFACE: APP PRINCIPAL ==========
  return (
    <div style={styles.appContainer}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {logoUrl && <img src={logoUrl} alt="Logo" style={styles.miniLogo} />}
          <h2 style={styles.empresaTitle}>{nomeEmpresa || "Pragendar R$"}</h2>
        </div>
        <button onClick={() => signOut(auth)} style={styles.btnSair}>Sair</button>
      </div>

      <div style={styles.tabBar}>
        {['agenda', 'financeiro', 'clientes', 'estoque', 'perfil'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={t === tab ? styles.tabActive : styles.tabInactive}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "agenda" && (
        <div>
          <div style={styles.calendarHeader}>
            <button onClick={() => setViewMonth(v => (v - 1 + 12) % 12)} style={styles.btnMini}>←</button>
            <strong>{viewMonth + 1}/{viewYear}</strong>
            <button onClick={() => setViewMonth(v => (v + 1) % 12)} style={styles.btnMini}>→</button>
          </div>
          
          <div style={styles.calendarGrid}>
            {Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, i) => i + 1).map(dia => (
              <div key={dia} onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))}
                   style={selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? styles.daySelected : styles.dayNormal}>
                {dia}
              </div>
            ))}
          </div>

          <h3>Agenda: {selectedDate.toLocaleDateString()}</h3>
          {Array.from({ length: 12 }, (_, i) => i + 8).map(hora => {
            const app = getAppDoHorario(hora);
            const isStart = app && new Date(app.dataHora).getHours() === hora;
            return (
              <div key={hora} style={{ ...styles.hourRow, borderLeft: app ? '5px solid #ff9800' : '5px solid #eee' }}>
                <span style={{ width: '50px' }}>{hora}:00</span>
                <div style={{ flex: 1 }}>
                  {app ? (
                    <div onClick={() => { setSelHora(hora); setEditAppId(app.id); setClientSearch(getNome(clients, app.clientId)); setShowModal(true); }}>
                      <strong>{getNome(clients, app.clientId)}</strong>
                    </div>
                  ) : (
                    <span onClick={() => { setSelHora(hora); setEditAppId(null); setClientSearch(""); setShowModal(true); }} style={{ color: 'green' }}>+ Livre</span>
                  )}
                </div>
                {isStart && <button onClick={() => sendWhatsAppReminder(app)} style={styles.btnZap}>📱</button>}
                {isStart && app.status !== 'pago' && <button onClick={() => handlePaymentClick(app)} style={styles.btnPay}>💵</button>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "financeiro" && (
        <div>
          <div style={styles.card}>
            <h3>Resumo Mensal</h3>
            {(() => {
              const chart = getChartData();
              return (
                <div>
                  <p>Total: R$ {chart.total}</p>
                  <div style={styles.barBG}><div style={{ ...styles.barIN, width: chart.pix + '%', background: '#9c27b0' }} /></div>
                  <small>Pix: {chart.pix}%</small>
                  <div style={styles.barBG}><div style={{ ...styles.barIN, width: chart.cartao + '%', background: '#2196f3' }} /></div>
                  <small>Cartão: {chart.cartao}%</small>
                </div>
              );
            })()}
            <button onClick={printReport} style={{ ...styles.btnPrincipal, marginTop: '10px', background: '#607d8b' }}>Imprimir Relatório</button>
          </div>
          
          <div style={styles.card}>
            <h3>Novo Lançamento</h3>
            <input placeholder="Descrição" value={descFin} onChange={e => setDescFin(e.target.value)} style={styles.input} />
            <input placeholder="Valor R$" type="number" value={valorFin} onChange={e => setValorFin(e.target.value)} style={styles.input} />
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={styles.input}>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
            </select>
            <button onClick={() => handleSaveTransaction()} style={styles.btnPrincipal}>Gravar</button>
          </div>
        </div>
      )}

      {tab === "clientes" && (
        <div>
          <div style={styles.card}>
            <h3>Importar Contatos</h3>
            <p style={{ fontSize: '12px', color: '#666' }}>Importe quantos contatos forem necessários! ✨</p>
            <input type="file" accept=".csv" onChange={handleCSVImport} disabled={importingCSV} style={styles.input} />
            {importingCSV && <p style={{ color: '#2196f3', fontWeight: 'bold' }}>⏳ Importando todos os contatos...</p>}
          </div>
          <input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={styles.input} />
          {clients.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(c => {
            const fid = getClientFidelity(c.id);
            return (
              <div key={c.id} style={styles.itemRow} onClick={() => { setSelectedClientForHistory(c); setShowClientHistoryModal(true); }}>
                <span>{c.nome} {fid.achieved && "🎁"}</span>
                <small>{c.telefone}</small>
              </div>
            );
          })}
        </div>
      )}

      {tab === "estoque" && (
        <div>
          <div style={styles.card}>
            <h3>Novo Produto</h3>
            <input placeholder="Nome" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} style={styles.input} />
            <input placeholder="Qtd" type="number" value={qtdProduto} onChange={e => setQtdProduto(e.target.value)} style={styles.input} />
            <input placeholder="Alerta Mínimo" type="number" value={alerta} onChange={e => setAlerta(e.target.value)} style={styles.input} />
            <button onClick={handleSaveProduct} style={styles.btnPrincipal}>Salvar</button>
          </div>
          {inventory.map(p => (
            <div key={p.id} style={{ ...styles.itemRow, background: p.quantidade <= p.alertaCritico ? '#ffebee' : '#fff' }}>
              <strong>{p.nome}</strong>
              <span>Qtd: {p.quantidade} {p.quantidade <= p.alertaCritico && "⚠️"}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "perfil" && (
        <div style={styles.card}>
          <h3>Meu Perfil</h3>
          <input placeholder="Nome do Salão" value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} style={styles.input} />
          <label>Logo:</label>
          <input type="file" onChange={handleFileUpload} disabled={uploadingLogo} style={styles.input} />
          {uploadingLogo && <p style={{ color: '#2196f3' }}>⏳ Enviando...</p>}
          <input type="time" value={horarioAbertura} onChange={e => setHorarioAbertura(e.target.value)} style={styles.input} />
          <input type="time" value={horarioFechamento} onChange={e => setHorarioFechamento(e.target.value)} style={styles.input} />
          <button onClick={handleSaveProfile} style={styles.btnPrincipal}>Salvar Alterações</button>
        </div>
      )}

      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>Agendar às {selHora}:00</h3>
            <input placeholder="Nome da cliente..." value={clientSearch} onChange={e => { setClientSearch(e.target.value); setSelCliente(""); }} style={styles.input} />
            <select value={selServico} onChange={e => setSelServico(e.target.value)} style={styles.input}>
              <option value="">Selecione o Serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R${s.preco})</option>)}
            </select>
            <button onClick={async () => {
              if (!selCliente || !selServico) return alert("Selecione cliente e serviço");
              const d = new Date(selectedDate); d.setHours(selHora, 0, 0);
              await addDoc(collection(db, "appointments"), { clientId: selCliente, serviceId: selServico, dataHora: d.toISOString(), status: "pendente", tenantId: user.uid });
              setShowModal(false); loadData(user.uid);
            }} style={styles.btnPrincipal}>Confirmar</button>
            <button onClick={() => setShowModal(false)} style={styles.btnSecundario}>Fechar</button>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>Confirmar Recebimento</h3>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={styles.input}>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
            </select>
            <button onClick={confirmPayment} style={styles.btnPrincipal}>Confirmar</button>
            <button onClick={() => setShowPaymentModal(false)} style={styles.btnSecundario}>Cancelar</button>
          </div>
        </div>
      )}

      {showClientHistoryModal && selectedClientForHistory && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>Histórico: {selectedClientForHistory.nome}</h3>
            {(() => {
              const h = getClientHistory(selectedClientForHistory.id);
              const fid = getClientFidelity(selectedClientForHistory.id);
              return (
                <div>
                  <p>Total investido: R$ {h.totalGasto.toFixed(2)}</p>
                  <p>Atendimentos: {h.count}</p>
                  <p>Fidelidade: {fid.count}/{fidelidadeLimit} {fid.achieved && "🎁"}</p>
                </div>
              );
            })()}
            <button onClick={() => setShowClientHistoryModal(false)} style={styles.btnSecundario}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== ESTILOS ==========
const styles = {
  loginPage: { padding: '50px 20px', textAlign: 'center', backgroundColor: '#fafafa', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  mainTitle: { color: '#d81b60', fontSize: '2.5rem', marginBottom: '30px' },
  appContainer: { maxWidth: '500px', margin: '0 auto', padding: '15px', backgroundColor: '#fff', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #eee' },
  miniLogo: { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' },
  empresaTitle: { color: '#d81b60', margin: 0, fontSize: '1.2rem' },
  card: { padding: '20px', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '20px' },
  input: { width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '14px' },
  btnPrincipal: { width: '100%', padding: '14px', backgroundColor: '#d81b60', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  btnSecundario: { width: '100%', padding: '10px', backgroundColor: '#eee', color: '#333', border: 'none', borderRadius: '8px', marginTop: '5px', cursor: 'pointer' },
  btnSair: { padding: '8px 15px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' },
  tabBar: { display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto' },
  tabActive: { flex: 1, padding: '10px', backgroundColor: '#d81b60', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' },
  tabInactive: { flex: 1, padding: '10px', backgroundColor: '#eee', color: '#555', border: 'none', borderRadius: '6px', fontSize: '12px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '20px' },
  dayNormal: { padding: '10px 0', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  daySelected: { padding: '10px 0', textAlign: 'center', backgroundColor: '#d81b60', color: '#fff', borderRadius: '6px', fontWeight: 'bold' },
  hourRow: { display: 'flex', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f0f0f0', gap: '10px' },
  btnZap: { background: '#25D366', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer' },
  btnPay: { background: '#4caf50', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer' },
  barBG: { width: '100%', height: '8px', background: '#eee', borderRadius: '4px', margin: '8px 0' },
  barIN: { height: '100%', borderRadius: '4px', transition: 'width 0.5s' },
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: '#fff', padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '380px' },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #eee', cursor: 'pointer' },
  toggleText: { color: '#d81b60', cursor: 'pointer', marginTop: '15px', fontSize: '14px' },
  calendarHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  btnMini: { padding: '5px 10px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }
};
