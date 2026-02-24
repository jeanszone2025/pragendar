import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
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

  // Estados de Formulário/Edição
  const [showModal, setShowModal] = useState(false);
  const [editAppId, setEditAppId] = useState(null);
  const [selCliente, setSelCliente] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selServico, setSelServico] = useState("");
  const [selHora, setSelHora] = useState("");

  // Outros estados (Financeiro/Clientes/Serviços)
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");

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
    } catch (error) { console.error(error); }
  }

  useEffect(() => { loadData(); }, []);

  // --- LÓGICA DO CALENDÁRIO ---
  const diasNoMes = new Date(viewYear, viewMonth + 1, 0).getDate();
  const primeiroDiaSemana = new Date(viewYear, viewMonth, 1).getDay();
  const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const horariosDisponiveis = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 às 20:00

  const getAppDoHorario = (hora) => {
    const dataBusca = new Date(selectedDate);
    dataBusca.setHours(hora, 0, 0, 0);
    return appointments.find(a => {
      const d = new Date(a.dataHora);
      return d.getFullYear() === dataBusca.getFullYear() &&
             d.getMonth() === dataBusca.getMonth() &&
             d.getDate() === dataBusca.getDate() &&
             d.getHours() === hora;
    });
  };

  // --- AÇÕES DE AGENDAMENTO ---
  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    if (!selCliente || !selServico) return alert("Selecione cliente e serviço!");

    const dataFinal = new Date(selectedDate);
    dataFinal.setHours(parseInt(selHora), 0, 0, 0);

    const appData = { 
      clientId: selCliente, 
      serviceId: selServico, 
      dataHora: dataFinal.toISOString(), 
      status: "pendente", 
      tenantId: "CRIS" 
    };

    if (editAppId) {
      await updateDoc(doc(db, "appointments", editAppId), appData);
    } else {
      await addDoc(collection(db, "appointments"), { ...appData, createdAt: serverTimestamp() });
    }

    setShowModal(false); setEditAppId(null); setSelCliente(""); setClientSearch(""); loadData();
  };

  const abrirAgendamento = (hora, appExistente = null) => {
    setSelHora(hora);
    if (appExistente) {
      setEditAppId(appExistente.id);
      setSelCliente(appExistente.clientId);
      setSelServico(appExistente.serviceId);
      setClientSearch(clients.find(c => c.id === appExistente.clientId)?.nome || "");
    } else {
      setEditAppId(null);
      setSelCliente("");
      setClientSearch("");
    }
    setShowModal(true);
  };

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";

  return (
    <div style={{ padding: '15px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto', color: '#333' }}>
      <h1 style={{ color: '#d81b60', textAlign: 'center', fontSize: '24px' }}>Pragendar R$</h1>
      
      {/* Menu de Abas */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto' }}>
        <button onClick={() => setTab("agenda")} style={btnTab(tab === "agenda")}>Agenda</button>
        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>
        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>
      </div>

      {tab === "agenda" && (
        <div>
          {/* Cabeçalho do Calendário */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <button onClick={() => setViewMonth(v => v - 1)} style={btnMini}>{"<"}</button>
            <strong style={{fontSize: '18px'}}>{nomeMeses[viewMonth]} {viewYear}</strong>
            <button onClick={() => setViewMonth(v => v + 1)} style={btnMini}>{">"}</button>
          </div>

          {/* Grade do Calendário */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '20px' }}>
            {["D","S","T","Q","Q","S","S"].map(d => <div key={d} style={{textAlign:'center', fontSize:'12px', fontWeight:'bold'}}>{d}</div>)}
            {Array(primeiroDiaSemana).fill(null).map((_, i) => <div key={i}></div>)}
            {Array.from({ length: diasNoMes }, (_, i) => i + 1).map(dia => {
              const isSelected = selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth;
              const isHoje = new Date().getDate() === dia && new Date().getMonth() === viewMonth;
              return (
                <div 
                  key={dia} 
                  onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))}
                  style={{ 
                    padding: '10px 5px', textAlign: 'center', borderRadius: '5px', cursor: 'pointer',
                    backgroundColor: isSelected ? '#d81b60' : (isHoje ? '#fce4ec' : '#fff'),
                    color: isSelected ? '#fff' : '#333',
                    border: '1px solid #eee'
                  }}
                >
                  {dia}
                </div>
              );
            })}
          </div>

          {/* Agenda do Dia Selecionado */}
          <h3 style={{borderBottom: '2px solid #d81b60', paddingBottom: '5px'}}>
            Dia {selectedDate.getDate()} de {nomeMeses[selectedDate.getMonth()]}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {horariosDisponiveis.map(hora => {
              const app = getAppDoHorario(hora);
              const isDomingo = selectedDate.getDay() === 0;
              return (
                <div key={hora} style={{ ...itemStyle, backgroundColor: app ? '#fff' : '#f9f9f9' }}>
                  <div style={{ fontWeight: 'bold', width: '60px' }}>{hora}:00</div>
                  <div style={{ flex: 1 }}>
                    {isDomingo ? (
                      <span style={{color: '#999', fontSize: '13px'}}>Fechado</span>
                    ) : app ? (
                      <div onClick={() => abrirAgendamento(hora, app)} style={{cursor: 'pointer'}}>
                        <strong>{getNome(clients, app.clientId)}</strong><br/>
                        <small style={{color: '#d81b60'}}>{getNome(services, app.serviceId)}</small>
                      </div>
                    ) : (
                      <button onClick={() => abrirAgendamento(hora)} style={{ color: '#4caf50', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px' }}>
                        + Disponível (Agendar)
                      </button>
                    )}
                  </div>
                  {app && <button onClick={() => deleteDoc(doc(db, "appointments", app.id)).then(loadData)} style={{background:'none', border:'none', color:'#ff9800'}}>🗑️</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE AGENDAMENTO COM BUSCADOR */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>{editAppId ? "Editar Horário" : "Novo Agendamento"} - {selHora}:00</h3>
            <form onSubmit={handleSaveAppointment}>
              
              {/* BUSCADOR DE CLIENTE */}
              <div style={{position: 'relative', marginBottom: '10px'}}>
                <input 
                  placeholder="🔍 Digite o nome da cliente..." 
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    const found = clients.find(c => c.nome.toLowerCase() === e.target.value.toLowerCase());
                    if(found) setSelCliente(found.id);
                  }}
                  style={inputStyle}
                />
                {clientSearch && !selCliente && (
                  <div style={dropdownStyle}>
                    {clients.filter(c => c.nome.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                      <div key={c.id} onClick={() => {setSelCliente(c.id); setClientSearch(c.nome)}} style={dropdownItem}>
                        {c.nome}
                      </div>
                    ))}
                  </div>
                )}
                {selCliente && <small style={{color: 'green'}}>✓ Cliente selecionada: {getNome(clients, selCliente)}</small>}
              </div>

              <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
                <option value="">Selecione o Serviço</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R${s.preco})</option>)}
              </select>

              <div style={{display:'flex', gap:'10px'}}>
                <button type="submit" style={btnStyle}>Salvar</button>
                <button type="button" onClick={() => setShowModal(false)} style={{...btnStyle, backgroundColor:'#ccc'}}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Abas de Clientes e Serviços permanecem acessíveis */}
      {tab === "clientes" && (/* ... seu código de clientes aqui ... */ null)}
      {tab === "servicos" && (/* ... seu código de serviços aqui ... */ null)}
    </div>
  );
}

// Estilos
const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' });
const btnMini = { padding: '5px 15px', backgroundColor: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { flex: 1, padding: '12px', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#d81b60' };
const itemStyle = { display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '8px', border: '1px solid #eee' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '400px' };
const dropdownStyle = { position: 'absolute', top: '100%', left: 0, width: '100%', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '5px', zIndex: 10, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const dropdownItem = { padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' };
