import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Estados do Calendário
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  // Estados de Busca e Filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // Estados de Modal e Edição
  const [showModal, setShowModal] = useState(false);
  const [editAppId, setEditAppId] = useState(null);
  const [selCliente, setSelCliente] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selServico, setSelServico] = useState("");
  const [selHora, setSelHora] = useState("");
  const [editId, setEditId] = useState(null);

  // Estados de Cadastro
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");

  // Estados Financeiros
  const [descFin, setDescFin] = useState("");
  const [valorFin, setValorFin] = useState("");
  const [tipoFin, setTipoFin] = useState("receita");

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
    } catch (error) { console.error("Erro ao carregar:", error); }
  }

  useEffect(() => { loadData(); }, []);

  // --- LOGICA DE BLOQUEIO DE HORARIOS ---
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

  // --- ACOES ---
  const handleConfirmPayment = async (app) => {
    const serv = services.find(s => s.id === app.serviceId);
    const cli = clients.find(c => c.id === app.clientId);
    await addDoc(collection(db, "transactions"), {
      descricao: `Pago: ${cli?.nome} (${serv?.nome})`,
      valor: serv?.preco || 0,
      tipo: "receita",
      data: new Date().toISOString(),
      tenantId: "CRIS"
    });
    await updateDoc(doc(db, "appointments", app.id), { status: "pago" });
    loadData();
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      const batch = writeBatch(db);
      event.target.result.split("\n").slice(1).forEach(line => {
        const col = line.split(",");
        if(col[0]) batch.set(doc(collection(db, "clients")), { nome: col[0].trim(), telefone: col[1]?.trim(), tenantId: "CRIS", createdAt: serverTimestamp() });
      });
      await batch.commit(); loadData();
    };
    reader.readAsText(file);
  };

  const deleteWithConfirm = async (col, id, nome, tel = "") => {
    if (window.confirm(`Deseja excluir ${nome} ${tel ? `(${tel})` : ""}?`)) {
      await deleteDoc(doc(db, col, id));
      loadData();
    }
  };

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";

  return (
    <div style={{ padding: '15px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
      <h1 style={{ color: '#d81b60', textAlign: 'center' }}>Pragendar R$</h1>
      
      <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto' }}>
        <button onClick={() => setTab("agenda")} style={btnTab(tab === "agenda")}>Agenda</button>
        <button onClick={() => setTab("financeiro")} style={btnTab(tab === "financeiro")}>Financeiro</button>
        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>
        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>
      </div>

      {tab === "agenda" && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button onClick={() => setViewMonth(v => v - 1)} style={btnMini}>{"<"}</button>
            <strong>{viewYear} - {viewMonth + 1}</strong>
            <button onClick={() => setViewMonth(v => v + 1)} style={btnMini}>{">"}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '15px' }}>
            {Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, i) => i + 1).map(dia => (
              <div key={dia} onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))}
                style={{ padding: '8px 0', textAlign: 'center', borderRadius: '5px', cursor: 'pointer', border: '1px solid #eee',
                backgroundColor: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#d81b60' : '#fff',
                color: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#fff' : '#333' }}>
                {dia}
              </div>
            ))}
          </div>
          <h3>{selectedDate.toLocaleDateString('pt-BR')}</h3>
          {Array.from({ length: 13 }, (_, i) => i + 8).map(hora => {
            const app = getAppDoHorario(hora);
            const isStart = app && new Date(app.dataHora).getHours() === hora;
            return (
              <div key={hora} style={{ ...itemStyle, borderLeft: app?.status === 'pago' ? '5px solid #4caf50' : (app ? '5px solid #ff9800' : '1px solid #eee') }}>
                <div style={{ width: '50px', fontWeight: 'bold' }}>{hora}:00</div>
                <div style={{ flex: 1 }}>
                  {app ? (
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

      {tab === "financeiro" && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ ...cardStyle, backgroundColor: '#e8f5e9' }}>Hoje: <strong>R$ {calcTotal(transactions, "hoje")}</strong></div>
            <div style={{ ...cardStyle, backgroundColor: '#f3e5f5' }}>Mês: <strong>R$ {calcTotal(transactions, "mes")}</strong></div>
          </div>
          <h3>Extrato do Dia</h3>
          {transactions.filter(t => new Date(t.data).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR')).map(t => (
            <div key={t.id} style={itemStyle}>
              <span>{t.descricao}</span>
              <strong style={{color: t.tipo==='receita'?'green':'red'}}>{t.tipo==='receita'?'+':'-'} R${t.valor}</strong>
            </div>
          ))}
        </div>
      )}

      {tab === "clientes" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar" : "Novo"} Cliente</h3>
            <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
            <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              const d = { nome: nomeCliente, telefone, tenantId: "CRIS" };
              if(editId) await updateDoc(doc(db, "clients", editId), d);
              else await addDoc(collection(db, "clients"), d);
              setEditId(null); setNomeCliente(""); setTelefone(""); loadData();
            }} style={btnStyle}>Salvar</button>
            <input type="file" onChange={handleImportCSV} style={{marginTop:'10px', fontSize:'10px'}} />
          </section>
          <input placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '10px' }}>
            {alfabeto.map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={btnLetter(selectedLetter === l)}>{l}</button>)}
          </div>
          {clients.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || c.nome.toUpperCase().startsWith(selectedLetter))).map(c => (
            <div key={c.id} style={itemStyle}>
              {c.nome} ({c.telefone})
              <div>
                <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome); setTelefone(c.telefone)}} style={btnEdit}>✏️</button>
                <button onClick={() => deleteWithConfirm("clients", c.id, c.nome, c.telefone)} style={btnDel}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "servicos" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar" : "Novo"} Serviço</h3>
            <input placeholder="Nome" value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
            <input placeholder="Preço" type="number" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />
            <input placeholder="Duração (min)" type="number" value={duracao} onChange={e => setDuracao(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              const d = { nome: nomeServico, preco: Number(preco), duracao: Number(duracao), tenantId: "CRIS" };
              if(editId) await updateDoc(doc(db, "services", editId), d);
              else await addDoc(collection(db, "services"), d);
              setEditId(null); setNomeServico(""); setPreco(""); setDuracao(""); loadData();
            }} style={btnStyle}>Salvar</button>
          </section>
          {services.map(s => (
            <div key={s.id} style={itemStyle}>
              {s.nome} - R${s.preco} ({s.duracao}min)
              <div>
                <button onClick={() => {setEditId(s.id); setNomeServico(s.nome); setPreco(s.preco); setDuracao(s.duracao)}} style={btnEdit}>✏️</button>
                <button onClick={() => deleteWithConfirm("services", s.id, s.nome)} style={btnDel}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>{editAppId ? "Editar" : "Novo"} Agendamento {selHora}:00</h3>
            <input placeholder="🔍 Buscar cliente..." value={clientSearch} onChange={e => {setClientSearch(e.target.value); setSelCliente("");}} style={inputStyle} />
            {clientSearch && !selCliente && (
              <div style={dropdownStyle}>
                {clients.filter(c => c.nome.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                  <div key={c.id} onClick={() => {setSelCliente(c.id); setClientSearch(c.nome)}} style={dropdownItem}>{c.nome} ({c.telefone})</div>
                ))}
              </div>
            )}
            <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
              <option value="">Selecione o Serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R${s.preco})</option>)}
            </select>
            <button onClick={async () => {
              if(!selCliente || !selServico) return alert("Selecione Cliente e Serviço!");
              const dFinal = new Date(selectedDate); dFinal.setHours(selHora, 0, 0, 0);
              const d = { clientId: selCliente, serviceId: selServico, dataHora: dFinal.toISOString(), status: "pendente", tenantId: "CRIS" };
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

// Auxiliares
const calcTotal = (list, p) => {
  const h = new Date().toLocaleDateString('pt-BR');
  const m = new Date().getMonth();
  return list.filter(t => {
    const d = new Date(t.data);
    return (p === "hoje" ? d.toLocaleDateString('pt-BR') === h : d.getMonth() === m) && t.tipo === "receita";
  }).reduce((acc, c) => acc + c.valor, 0);
};

// Estilos
const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' });
const btnMini = { padding: '5px 15px', backgroundColor: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: '12px', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#d81b60' };
const itemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px' };
const cardStyle = { padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #eee' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '350px' };
const dropdownStyle = { backgroundColor: '#fff', border: '1px solid #ccc', maxHeight: '100px', overflowY: 'auto' };
const dropdownItem = { padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' };
const btnPay = { backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 10px', marginLeft: '5px' };
const btnDel = { backgroundColor: '#ffcdd2', color: '#c62828', border: 'none', borderRadius: '5px', padding: '5px 10px', marginLeft: '5px' };
const btnEdit = { backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', borderRadius: '5px', padding: '5px 10px' };
const btnLetter = (active) => ({ padding: '3px', minWidth: '20px', fontSize: '9px', backgroundColor: active ? '#d81b60' : '#f0f0f0', color: active ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' });
