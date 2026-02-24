import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, writeBatch, query, where } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./firebase";

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
  const [editAppId, setEditAppId] = useState(null);
  const [selCliente, setSelCliente] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selServico, setSelServico] = useState("");
  const [selHora, setSelHora] = useState("");
  const [editId, setEditId] = useState(null);

  // --- ESTADOS DE FORMULÁRIOS ---
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descFin, setDescFin] = useState("");
  const [valorFin, setValorFin] = useState("");
  const [tipoFin, setTipoFin] = useState("receita");

  // --- ESTADOS DO PERFIL ---
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [telefoneProfissional, setTelefoneProfissional] = useState("");
  const [horarioAbertura, setHorarioAbertura] = useState("09:00");
  const [horarioFechamento, setHorarioFechamento] = useState("19:00");
  const [editingProfile, setEditingProfile] = useState(false);

  // ========== MONITORAMENTO DE AUTENTICAÇÃO ==========
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        loadData();
        loadProfile();
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

  async function loadData() {
    try {
      const qC = await getDocs(collection(db, "clients"));
      setClients(qC.docs.map(d => ({ id: d.id, ...d.data() })));
      const qS = await getDocs(collection(db, "services"));
      setServices(qS.docs.map(d => ({ id: d.id, ...d.data() })));
      const qA = await getDocs(collection(db, "appointments"));
      setAppointments(qA.docs.map(d => ({ id: d.id, ...d.data() })));
      const qT = await getDocs(collection(db, "transactions"));
      setTransactions(qT.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error("Erro ao carregar dados:", error); }
  }

  // ========== FUNÇÕES DO PERFIL ==========
  async function loadProfile() {
    try {
      if (!user) return;
      const qP = await getDocs(query(collection(db, "profiles"), where("userId", "==", user.uid)));
      if (!qP.empty) {
        const profileData = qP.docs[0].data();
        setProfile({ id: qP.docs[0].id, ...profileData });
        setNomeEmpresa(profileData.nomeEmpresa || "");
        setLogoUrl(profileData.logoUrl || "");
        setTelefoneProfissional(profileData.telefoneProfissional || "");
        setHorarioAbertura(profileData.horarioAbertura || "09:00");
        setHorarioFechamento(profileData.horarioFechamento || "19:00");
      }
    } catch (error) { console.error("Erro ao carregar perfil:", error); }
  }

  const handleSaveProfile = async () => {
    try {
      if (!user) return;
      const profileData = {
        userId: user.uid,
        nomeEmpresa,
        logoUrl,
        telefoneProfissional,
        horarioAbertura,
        horarioFechamento,
        updatedAt: new Date().toISOString()
      };

      if (profile) {
        await updateDoc(doc(db, "profiles", profile.id), profileData);
      } else {
        await addDoc(collection(db, "profiles"), profileData);
      }
      setEditingProfile(false);
      loadProfile();
      alert("Perfil salvo com sucesso!");
    } catch (error) {
      alert("Erro ao salvar perfil: " + error.message);
    }
  };

  // --- LÓGICA DE BLOQUEIO DE HORÁRIOS (JANELA DE OCUPAÇÃO) ---
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

  // --- FUNÇÕES DE FINANCEIRO (EDITAR / EXCLUIR / RECEBER) ---
  const handleConfirmPayment = async (app) => {
    const serv = services.find(s => s.id === app.serviceId);
    const cli = clients.find(c => c.id === app.clientId);
    await addDoc(collection(db, "transactions"), {
      descricao: `Atendimento: ${cli?.nome} (${serv?.nome})`,
      valor: Number(serv?.preco || 0),
      tipo: "receita",
      data: new Date().toISOString(),
      tenantId: user.uid,
      appointmentId: app.id
    });
    await updateDoc(doc(db, "appointments", app.id), { status: "pago" });
    loadData(); alert("Pagamento recebido!");
  };

  const handleSaveTransaction = async () => {
    const d = { descricao: descFin, valor: Number(valorFin), tipo: tipoFin, data: new Date().toISOString(), tenantId: user.uid };
    if (editId) await updateDoc(doc(db, "transactions", editId), d);
    else await addDoc(collection(db, "transactions"), d);
    setEditId(null); setDescFin(""); setValorFin(""); loadData();
  };

  // --- AUXILIARES ---
  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";
  const getTel = (list, id) => list.find(i => i.id === id)?.telefone || "";

  const deleteWithConfirm = async (col, id, nome, extra = "") => {
    if (window.confirm(`Tem certeza que deseja excluir ${nome} ${extra ? `(${extra})` : ""}?`)) {
      await deleteDoc(doc(db, col, id));
      loadData();
    }
  };

  // ========== RENDERIZAÇÃO CONDICIONAL - TELA DE LOGIN ==========
  if (!user) {
    return (
      <div style={{ padding: '40px 20px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' }}>
        <h1 style={{ color: '#d81b60', marginBottom: '30px' }}>Pragendar R$</h1>
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
          <p onClick={() => setAuthTab(authTab === "login" ? "cadastro" : "login")} style={{ cursor: 'pointer', color: '#d81b60', marginTop: '15px', fontSize: '14px' }}>
            {authTab === "login" ? "Novo por aqui? Cadastre-se" : "Já tem conta? Faça Login"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '15px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
      {/* HEADER COM LOGO E BOTÃO DE SAIR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />}
          <div>
            <h1 style={{ color: '#d81b60', margin: 0, fontSize: '18px' }}>{nomeEmpresa || "Pragendar R$"}</h1>
          </div>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: '8px 15px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          Sair
        </button>
      </div>
      
      {/* TABS PRINCIPAIS */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto' }}>
        <button onClick={() => setTab("agenda")} style={btnTab(tab === "agenda")}>Agenda</button>
        <button onClick={() => setTab("financeiro")} style={btnTab(tab === "financeiro")}>Financeiro</button>
        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>
        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>
        <button onClick={() => setTab("perfil")} style={btnTab(tab === "perfil")}>Perfil</button>
      </div>

      {/* ABA AGENDA COM CALENDÁRIO E TIMELINE */}
      {tab === "agenda" && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button onClick={() => setViewMonth(v => v - 1)} style={btnMini}>{"<"}</button>
            <strong>{nomeMeses[viewMonth]} {viewYear}</strong>
            <button onClick={() => setViewMonth(v => v + 1)} style={btnMini}>{">"}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '15px' }}>
            {["D","S","T","Q","Q","S","S"].map(d => <div key={d} style={{textAlign:'center', fontSize:'10px', fontWeight:'bold'}}>{d}</div>)}
            {Array(new Date(viewYear, viewMonth, 1).getDay()).fill(null).map((_, i) => <div key={i}></div>)}
            {Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, i) => i + 1).map(dia => (
              <div key={dia} onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))}
                style={{ padding: '8px 0', textAlign: 'center', borderRadius: '5px', cursor: 'pointer', border: '1px solid #eee',
                backgroundColor: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#d81b60' : '#fff',
                color: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#fff' : '#333' }}>
                {dia}
              </div>
            ))}
          </div>

          <h3 style={{borderBottom: '2px solid #d81b60'}}>Dia {selectedDate.toLocaleDateString('pt-BR')}</h3>
          {Array.from({ length: 13 }, (_, i) => i + 8).map(hora => {
            const app = getAppDoHorario(hora);
            const isStart = app && new Date(app.dataHora).getHours() === hora;
            const isDomingo = selectedDate.getDay() === 0;
            return (
              <div key={hora} style={{ ...itemStyle, borderLeft: app?.status === 'pago' ? '5px solid #4caf50' : (app ? '5px solid #ff9800' : '1px solid #eee') }}>
                <div style={{ width: '50px', fontWeight: 'bold' }}>{hora}:00</div>
                <div style={{ flex: 1 }}>
                  {isDomingo ? <span style={{color:'#999'}}>Fechado</span> : app ? (
                    <div onClick={() => {setSelHora(hora); setEditAppId(app.id); setSelCliente(app.clientId); setSelServico(app.serviceId); setClientSearch(getNome(clients, app.clientId)); setShowModal(true);}} style={{cursor:'pointer', opacity: isStart ? 1 : 0.6}}>
                      <strong>{getNome(clients, app.clientId)}</strong> {isStart && `- ${getNome(services, app.serviceId)}`}
                    </div>
                  ) : (
                    <span onClick={() => {setSelHora(hora); setEditAppId(null); setSelCliente(""); setClientSearch(""); setShowModal(true);}} style={{color: '#4caf50', cursor:'pointer'}}>+ Disponível</span>
                  )}
                </div>
                {isStart && app.status !== "pago" && <button onClick={() => handleConfirmPayment(app)} style={btnPay}>$</button>}
                {isStart && <button onClick={() => deleteWithConfirm("appointments", app.id, getNome(clients, app.clientId))} style={btnDel}>X</button>}
              </div>
            );
          })}
        </div>
      )}

      {/* ABA FINANCEIRO (COM EDITAR E EXCLUIR) */}
      {tab === "financeiro" && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ ...cardStyle, backgroundColor: '#e8f5e9' }}>Hoje: <strong>R$ {calcTotal(transactions, "hoje")}</strong></div>
            <div style={{ ...cardStyle, backgroundColor: '#f3e5f5' }}>Mês: <strong>R$ {calcTotal(transactions, "mes")}</strong></div>
          </div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar Lançamento" : "Novo Lançamento Manual"}</h3>
            <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={inputStyle}>
              <option value="receita">Receita (Entrada)</option>
              <option value="despesa">Despesa (Saída)</option>
            </select>
            <input placeholder="Descrição" value={descFin} onChange={e => setDescFin(e.target.value)} style={inputStyle} />
            <input placeholder="Valor R$" type="number" value={valorFin} onChange={e => setValorFin(e.target.value)} style={inputStyle} />
            <button onClick={handleSaveTransaction} style={{...btnStyle, backgroundColor: tipoFin==='receita'?'#4caf50':'#f44336'}}>{editId ? "Salvar Alteração" : "Gravar"}</button>
          </section>
          <h3>Extrato Detalhado</h3>
          {transactions.sort((a,b) => b.data.localeCompare(a.data)).map(t => (
            <div key={t.id} style={itemStyle}>
              <span style={{flex:1}}><small>{new Date(t.data).toLocaleDateString('pt-BR')}</small><br/>{t.descricao}</span>
              <strong style={{color: t.tipo==='receita'?'green':'red', marginRight:'10px'}}>{t.tipo==='receita'?'+':'-'} R${t.valor}</strong>
              <button onClick={() => {setEditId(t.id); setDescFin(t.descricao); setValorFin(t.valor); setTipoFin(t.tipo)}} style={btnEdit}>✏️</button>
              <button onClick={() => deleteWithConfirm("transactions", t.id, t.descricao)} style={btnDel}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* ABA CLIENTES (BUSCA A-Z) */}
      {tab === "clientes" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar" : "Novo"} Cliente</h3>
            <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
            <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              const d = { nome: nomeCliente, telefone, tenantId: user.uid };
              if(editId) await updateDoc(doc(db, "clients", editId), d);
              else await addDoc(collection(db, "clients"), d);
              setEditId(null); setNomeCliente(""); setTelefone(""); loadData();
            }} style={btnStyle}>Salvar Cliente</button>
          </section>
          <input placeholder="🔍 Buscar cliente pelo nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '10px' }}>
            {alfabeto.map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={btnLetter(selectedLetter === l)}>{l}</button>)}
            <button onClick={() => setSelectedLetter("")} style={btnLetter(selectedLetter === "")}>Tudo</button>
          </div>
          {clients.filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || c.nome?.toUpperCase().startsWith(selectedLetter))).map(c => (
            <div key={c.id} style={itemStyle}>
              <span style={{flex:1}}><strong>{c.nome}</strong><br/><small>{c.telefone}</small></span>
              <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome); setTelefone(c.telefone)}} style={btnEdit}>✏️</button>
              <button onClick={() => deleteWithConfirm("clients", c.id, c.nome, c.telefone)} style={btnDel}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* ABA SERVIÇOS (COM EDIÇÃO) */}
      {tab === "servicos" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar Serviço" : "Novo Serviço"}</h3>
            <input placeholder="Nome do Serviço" value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
            <input placeholder="Preço R$" type="number" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />
            <input placeholder="Duração (min)" type="number" value={duracao} onChange={e => setDuracao(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              const d = { nome: nomeServico, preco: Number(preco), duracao: Number(duracao), tenantId: user.uid };
              if(editId) await updateDoc(doc(db, "services", editId), d);
              else await addDoc(collection(db, "services"), d);
              setEditId(null); setNomeServico(""); setPreco(""); setDuracao(""); loadData();
            }} style={btnStyle}>Salvar Serviço</button>
          </section>
          {services.map(s => (
            <div key={s.id} style={itemStyle}>
              <span style={{flex:1}}><strong>{s.nome}</strong><br/><small>R${s.preco} - {s.duracao}min</small></span>
              <button onClick={() => {setEditId(s.id); setNomeServico(s.nome); setPreco(s.preco); setDuracao(s.duracao)}} style={btnEdit}>✏️</button>
              <button onClick={() => deleteWithConfirm("services", s.id, s.nome)} style={btnDel}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* ABA PERFIL (NOVO) */}
      {tab === "perfil" && (
        <div>
          <section style={cardStyle}>
            <h3>Perfil da Profissional</h3>
            {!editingProfile ? (
              <div>
                <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#eee', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#999' }}>Sem Logo</span>
                    </div>
                  )}
                  <p style={{ margin: '5px 0' }}><strong>{nomeEmpresa || "Seu Salão"}</strong></p>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>{telefoneProfissional || "Telefone não definido"}</p>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>
                    {horarioAbertura} às {horarioFechamento}
                  </p>
                </div>
                <button onClick={() => setEditingProfile(true)} style={{...btnStyle, backgroundColor: '#2196f3'}}>Editar Perfil</button>
              </div>
            ) : (
              <div>
                <input 
                  placeholder="Nome da Empresa/Salão" 
                  value={nomeEmpresa} 
                  onChange={e => setNomeEmpresa(e.target.value)} 
                  style={inputStyle} 
                />
                <input 
                  placeholder="URL da Logo" 
                  value={logoUrl} 
                  onChange={e => setLogoUrl(e.target.value)} 
                  style={inputStyle} 
                />
                <input 
                  placeholder="Telefone de Contato" 
                  value={telefoneProfissional} 
                  onChange={e => setTelefoneProfissional(e.target.value)} 
                  style={inputStyle} 
                />
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Horário de Abertura</label>
                <input 
                  type="time"
                  value={horarioAbertura} 
                  onChange={e => setHorarioAbertura(e.target.value)} 
                  style={inputStyle} 
                />
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Horário de Fechamento</label>
                <input 
                  type="time"
                  value={horarioFechamento} 
                  onChange={e => setHorarioFechamento(e.target.value)} 
                  style={inputStyle} 
                />
                <button onClick={handleSaveProfile} style={{...btnStyle, backgroundColor: '#4caf50'}}>Salvar Alterações</button>
                <button onClick={() => setEditingProfile(false)} style={{...btnStyle, backgroundColor: '#ccc', color: '#333', marginTop: '5px'}}>Cancelar</button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL DE AGENDAMENTO (COM BUSCADOR E EDIÇÃO) */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>{editAppId ? "Editar" : "Novo"} Agendamento {selHora}:00</h3>
            <div style={{position:'relative'}}>
              <input placeholder="🔍 Nome da cliente..." value={clientSearch} onChange={e => {setClientSearch(e.target.value); setSelCliente("");}} style={inputStyle} />
              {clientSearch && !selCliente && (
                <div style={dropdownStyle}>
                  {clients.filter(c => c.nome.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                    <div key={c.id} onClick={() => {setSelCliente(c.id); setClientSearch(c.nome)}} style={dropdownItem}>
                      {c.nome} <small>({c.telefone})</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
              <option value="">Selecione o Serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R${s.preco})</option>)}
            </select>
            <button onClick={async () => {
              if(!selCliente || !selServico) return alert("Selecione Cliente e Serviço!");
              const dFinal = new Date(selectedDate); dFinal.setHours(selHora, 0, 0, 0);
              const d = { clientId: selCliente, serviceId: selServico, dataHora: dFinal.toISOString(), status: "pendente", tenantId: user.uid };
              if(editAppId) await updateDoc(doc(db, "appointments", editAppId), d);
              else await addDoc(collection(db, "appointments"), d);
              setShowModal(false); loadData();
            }} style={btnStyle}>Confirmar</button>
            <button onClick={() => setShowModal(false)} style={{...btnStyle, backgroundColor:'#ccc', marginTop:'5px'}}>Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- AUXILIARES E ESTILOS ---
const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const calcTotal = (list, p) => {
  const h = new Date().toLocaleDateString('pt-BR');
  const m = new Date().getMonth();
  return list.filter(t => {
    const d = new Date(t.data);
    return (p === "hoje" ? d.toLocaleDateString('pt-BR') === h : d.getMonth() === m) && t.tipo === "receita";
  }).reduce((acc, c) => acc + c.valor, 0);
};

const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: active ? 'bold' : 'normal' });
const btnMini = { padding: '5px 15px', backgroundColor: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: '12px', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#d81b60' };
const itemStyle = { display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px', backgroundColor: '#fff' };
const cardStyle = { padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #eee', backgroundColor: '#fff' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '350px' };
const dropdownStyle = { position: 'absolute', top: '45px', left: 0, width: '100%', backgroundColor: '#fff', border: '1px solid #ccc', zIndex: 10, maxHeight: '100px', overflowY: 'auto' };
const dropdownItem = { padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' };
const btnPay = { backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 10px', marginLeft: '5px', cursor: 'pointer' };
const btnDel = { backgroundColor: '#ffcdd2', color: '#c62828', border: 'none', borderRadius: '5px', padding: '5px 10px', marginLeft: '5px', cursor: 'pointer' };
const btnEdit = { backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer' };
const btnLetter = (active) => ({ padding: '3px', minWidth: '22px', fontSize: '10px', backgroundColor: active ? '#d81b60' : '#f0f0f0', color: active ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' });
