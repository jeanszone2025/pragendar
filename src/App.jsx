import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Estados de Calendário
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  // Estados de Busca e Filtro (Clientes)
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

  // Estados de Cadastro
  const [editId, setEditId] = useState(null);
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
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadData(); }, []);

  // --- LÓGICA DE BLOQUEIO POR DURAÇÃO ---
  const getAppDoHorario = (hora) => {
    const dSel = new Date(selectedDate);
    return appointments.find(a => {
      const inicio = new Date(a.dataHora);
      const serv = services.find(s => s.id === a.serviceId);
      const dur = serv ? Number(serv.duracao) : 60;
      const fim = new Date(inicio.getTime() + dur * 60000);
      
      const mesmaData = inicio.getDate() === dSel.getDate() && inicio.getMonth() === dSel.getMonth() && inicio.getFullYear() === dSel.getFullYear();
      if (!mesmaData) return false;

      const horaAgenda = hora;
      const horaInicio = inicio.getHours();
      const horaFim = inicio.getHours() + (inicio.getMinutes() + dur) / 60;
      return horaAgenda >= horaInicio && horaAgenda < Math.ceil(horaFim);
    });
  };

  // --- FINANCEIRO ---
  const handleConfirmPayment = async (app) => {
    const serv = services.find(s => s.id === app.serviceId);
    const cli = clients.find(c => c.id === app.clientId);
    await addDoc(collection(db, "transactions"), {
      descricao: `Atendimento: ${cli?.nome}`, valor: serv?.preco || 0, tipo: "receita", data: new Date().toISOString(), tenantId: "CRIS", createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "appointments", app.id), { status: "pago" });
    loadData(); alert("Pago!");
  };

  const calcTotal = (tipo, periodo) => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const mes = new Date().getMonth();
    return transactions.filter(t => {
      const d = new Date(t.data);
      if(periodo === "hoje") return d.toLocaleDateString('pt-BR') === hoje && t.tipo === tipo;
      return d.getMonth() === mes && t.tipo === tipo;
    }).reduce((acc, curr) => acc + curr.valor, 0);
  };

  // --- CLIENTES FILTRADOS ---
  const clientesFiltrados = clients
    .filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(c => selectedLetter === "" || c.nome?.toUpperCase().startsWith(selectedLetter))
    .sort((a, b) => a.nome?.localeCompare(b.nome));

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";

  return (
    <div style={{ padding: '15px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto', backgroundColor: '#fdfdfd' }}>
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
                color: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#fff' : '#333' }}>{dia}</div>
            ))}
          </div>
          <h3>{selectedDate.toLocaleDateString('pt-BR')}</h3>
          {Array.from({ length: 13 }, (_, i) => i + 8).map(hora => {
            const app = getAppDoHorario(hora);
            const isStart = app && new Date(app.dataHora).getHours() === hora;
            return (
              <div key={hora} style={{ ...itemStyle, borderLeft: app?.status === 'pago' ? '5px solid #4caf50' : (app ? '5px solid #ff9800' : '1px solid #eee') }}>
                <div style={{ width: '45px', fontWeight: 'bold' }}>{hora}:00</div>
                <div style={{ flex: 1 }}>
                  {app ? (
                    <div onClick={() => { setSelHora(hora); setEditAppId(app.id); setSelCliente(app.clientId); setSelServico(app.serviceId); setClientSearch(getNome(clients, app.clientId)); setShowModal(true); }} style={{cursor:'pointer'}}>
                       <strong>{getNome(clients, app.clientId)}</strong> {isStart && `- ${getNome(services, app.serviceId)}`}
                    </div>
                  ) : (
                    <span onClick={() => {setSelHora(hora); setEditAppId(null); setSelCliente(""); setClientSearch(""); setShowModal(true);}} style={{color: '#4caf50', cursor:'pointer'}}>+ Disponível</span>
                  )}
                </div>
                {isStart && app.status !== "pago" && <button onClick={() => handleConfirmPayment(app)} style={btnPay}>$</button>}
                {isStart && <button onClick={() => {if(window.confirm("Excluir?")) deleteDoc(doc(db, "appointments", app.id)).then(loadData)}} style={btnDel}>X</button>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "financeiro" && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ ...cardStyle, backgroundColor: '#e8f5e9' }}>Hoje: <strong>R$ {calcTotal("receita", "hoje")}</strong></div>
            <div style={{ ...cardStyle, backgroundColor: '#f3e5f5' }}>Mês: <strong>R$ {calcTotal("receita", "mes")}</strong></div>
          </div>
          <section style={cardStyle}>
            <h3>Entradas/Saídas Manuais</h3>
            <input placeholder="O que é? (ex: Compra Esmalte)" value={descFin} onChange={e => setDescFin(e.target.value)} style={inputStyle} />
            <input placeholder="Valor" type="number" value={valorFin} onChange={e => setValorFin(e.target.value)} style={inputStyle} />
            <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={inputStyle}>
              <option value="receita">Entrada</option>
              <option value="despesa">Saída</option>
            </select>
            <button onClick={async () => {
              await addDoc(collection(db, "transactions"), { descricao: descFin, valor: Number(valorFin), tipo: tipoFin, data: new Date().toISOString(), tenantId: "CRIS" });
              setDescFin(""); setValorFin(""); loadData();
            }} style={btnStyle}>Gravar</button>
          </section>
          <h3>Extrato de Hoje</h3>
          {transactions.filter(t => new Date(t.data).toLocaleDateString() === new Date().toLocaleDateString()).map(t => (
            <div key={t.id} style={itemStyle}>
              <small>{new Date(t.data).toLocaleTimeString().slice(0,5)} - {t.descricao}</small>
              <strong style={{color: t.tipo === 'receita' ? 'green' : 'red'}}>{t.tipo==='receita'?'+':'-'} R$ {t.valor}</strong>
            </div>
          ))}
        </div>
      )}

      {tab === "clientes" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar" : "Nova"} Cliente</h3>
            <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
            <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              const d = { nome: nomeCliente, telefone, tenantId: "CRIS" };
              if(editId) await updateDoc(doc(db, "clients", editId), d);
              else await addDoc(collection(db, "clients"), d);
              setEditId(null); setNomeCliente(""); setTelefone(""); loadData();
            }} style={btnStyle}>Salvar Cliente</button>
          </section>
          <input placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '10px' }}>
            {alfabeto.map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={btnLetter(selectedLetter === l)}>{l}</button>)}
            <button onClick={() => setSelectedLetter("")} style={btnLetter(selectedLetter === "")}>Tudo</button>
          </div>
          {clientesFiltrados.map(c => (
            <div key={c.id} style={itemStyle}>
              {c.nome} 
              <div>
                <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome); setTelefone(c.telefone)}} style={btnEdit}>✏️</button>
                <button onClick={() => deleteDoc(doc(db, "clients", c.id)).then(loadData)} style={btnDel}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "servicos" && (
        <div>
          <section style={cardStyle}>
            <input placeholder="Serviço" value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
            <input placeholder="Preço" type="number" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />
            <input placeholder="Duração (min)" type="number" value={duracao} onChange={e => setDuracao(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              await addDoc(collection(db, "services"), { nome: nomeServico, preco: Number(preco), duracao: Number(duracao), tenantId: "CRIS" });
              setNomeServico(""); setPreco(""); setDuracao(""); loadData();
            }} style={btnStyle}>Cadastrar Serviço</button>
          </section>
          {services.map(s => <div key={s.id} style={itemStyle}>{s.nome} - R${s.preco} ({s.duracao}min)</div>)}
        </div>
      )}

      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>Agendar às {selHora}:00</h3>
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
              {services.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <button onClick={async () => {
              if(!selCliente || !selServico) return alert("Erro: Selecione a cliente e o serviço!");
              const dFinal = new Date(selectedDate); dFinal.setHours(selHora, 0, 0, 0);
              const data = { clientId: selCliente, serviceId: selServico, dataHora: dFinal.toISOString(), status: "pendente", tenantId: "CRIS" };
              if(editAppId) await updateDoc(doc(db, "appointments", editAppId), data);
              else await addDoc(collection(db, "appointments"), data);
              setShowModal(false); loadData();
            }} style={btnStyle}>Confirmar</button>
            <button onClick={() => setShowModal(false)} style={{...btnStyle, backgroundColor:'#ccc', marginTop:'5px'}}>Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ESTILOS
const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' });
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
