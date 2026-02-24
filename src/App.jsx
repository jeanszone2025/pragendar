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

  // Estados de Busca e Filtro (Clientes)
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // Estados de Formulário/Edição
  const [showModal, setShowModal] = useState(false);
  const [editAppId, setEditAppId] = useState(null);
  const [selCliente, setSelCliente] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selServico, setSelServico] = useState("");
  const [selHora, setSelHora] = useState("");

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
    } catch (error) { console.error(error); }
  }

  useEffect(() => { loadData(); }, []);

  // --- LÓGICA FINANCEIRA ---
  const handleConfirmPayment = async (app) => {
    const servico = services.find(s => s.id === app.serviceId);
    const cliente = clients.find(c => c.id === app.clientId);
    const valor = servico ? servico.preco : 0;
    try {
      await addDoc(collection(db, "transactions"), {
        descricao: `Atendimento: ${cliente?.nome || 'Cliente'}`,
        valor: valor,
        tipo: "receita",
        data: new Date().toISOString(),
        tenantId: "CRIS",
        appointmentId: app.id,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "appointments", app.id), { status: "pago" });
      alert("Pagamento recebido!"); loadData();
    } catch (e) { alert("Erro ao processar."); }
  };

  const calcTotal = (tipo, periodo) => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const mesAtual = new Date().getMonth();
    return transactions
      .filter(t => {
        const dataT = new Date(t.data);
        if (periodo === "hoje") return dataT.toLocaleDateString('pt-BR') === hoje && t.tipo === tipo;
        if (periodo === "mes") return dataT.getMonth() === mesAtual && t.tipo === tipo;
        return t.tipo === tipo;
      })
      .reduce((acc, curr) => acc + curr.valor, 0);
  };

  // --- LÓGICA DE CLIENTES (FILTRO E CSV) ---
  const clientesFiltrados = clients
    .filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(c => selectedLetter === "" || c.nome.toUpperCase().startsWith(selectedLetter))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const lines = event.target.result.split("\n");
      const batch = writeBatch(db);
      lines.slice(1).forEach((line) => {
        const columns = line.split(",");
        if (columns.length >= 2) {
          const newRef = doc(collection(db, "clients"));
          batch.set(newRef, { nome: columns[0].trim(), telefone: columns[1].trim(), tenantId: "CRIS", createdAt: serverTimestamp() });
        }
      });
      await batch.commit(); alert("Importado!"); loadData();
    };
    reader.readAsText(file);
  };

  // --- LÓGICA DO CALENDÁRIO ---
  const diasNoMes = new Date(viewYear, viewMonth + 1, 0).getDate();
  const primeiroDiaSemana = new Date(viewYear, viewMonth, 1).getDay();
  const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const horariosDisponiveis = Array.from({ length: 13 }, (_, i) => i + 8);

  const getAppDoHorario = (hora) => {
    const dSel = new Date(selectedDate);
    return appointments.find(a => {
      const d = new Date(a.dataHora);
      return d.getDate() === dSel.getDate() && d.getMonth() === dSel.getMonth() && d.getHours() === hora;
    });
  };

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";

  return (
    <div style={{ padding: '15px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto', color: '#333' }}>
      <h1 style={{ color: '#d81b60', textAlign: 'center', fontSize: '24px' }}>Pragendar R$</h1>
      
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
            <strong>{nomeMeses[viewMonth]} {viewYear}</strong>
            <button onClick={() => setViewMonth(v => v + 1)} style={btnMini}>{">"}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '15px' }}>
            {["D","S","T","Q","Q","S","S"].map(d => <div key={d} style={{textAlign:'center', fontSize:'10px'}}>{d}</div>)}
            {Array(primeiroDiaSemana).fill(null).map((_, i) => <div key={i}></div>)}
            {Array.from({ length: diasNoMes }, (_, i) => i + 1).map(dia => (
              <div key={dia} onClick={() => setSelectedDate(new Date(viewYear, viewMonth, dia))}
                style={{ padding: '8px 0', textAlign: 'center', borderRadius: '5px', cursor: 'pointer', border: '1px solid #eee',
                backgroundColor: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#d81b60' : '#fff',
                color: selectedDate.getDate() === dia && selectedDate.getMonth() === viewMonth ? '#fff' : '#333' }}>
                {dia}
              </div>
            ))}
          </div>

          <h3>Dia {selectedDate.getDate()} - Agenda</h3>
          {horariosDisponiveis.map(hora => {
            const app = getAppDoHorario(hora);
            return (
              <div key={hora} style={{ ...itemStyle, borderLeft: app?.status === 'pago' ? '5px solid #4caf50' : (app ? '5px solid #ff9800' : '1px solid #eee') }}>
                <div style={{ width: '50px', fontWeight: 'bold' }}>{hora}:00</div>
                <div style={{ flex: 1 }}>
                  {app ? (
                    <div onClick={() => {setSelHora(hora); setEditAppId(app.id); setSelCliente(app.clientId); setSelServico(app.serviceId); setClientSearch(getNome(clients, app.clientId)); setShowModal(true);}}>
                      <strong>{getNome(clients, app.clientId)}</strong> - {getNome(services, app.serviceId)}
                    </div>
                  ) : (
                    <span onClick={() => {setSelHora(hora); setEditAppId(null); setSelCliente(""); setClientSearch(""); setShowModal(true);}} style={{color: '#4caf50', cursor:'pointer'}}>+ Disponível</span>
                  )}
                </div>
                {app && app.status !== "pago" && <button onClick={() => handleConfirmPayment(app)} style={btnPay}>$</button>}
                {app && <button onClick={() => deleteDoc(doc(db, "appointments", app.id)).then(loadData)} style={btnDel}>X</button>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "financeiro" && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ ...cardStyle, backgroundColor: '#e8f5e9' }}>
              <small>Hoje</small><br/><strong>R$ {calcTotal("receita", "hoje")}</strong>
            </div>
            <div style={{ ...cardStyle, backgroundColor: '#f3e5f5' }}>
              <small>Mês</small><br/><strong>R$ {calcTotal("receita", "mes")}</strong>
            </div>
          </div>
          <section style={cardStyle}>
            <h3>Lançamento Manual</h3>
            <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={inputStyle}>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
            <input placeholder="Descrição" value={descFin} onChange={e => setDescFin(e.target.value)} style={inputStyle} />
            <input placeholder="Valor R$" type="number" value={valorFin} onChange={e => setValorFin(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              await addDoc(collection(db, "transactions"), { descricao: descFin, valor: Number(valorFin), tipo: tipoFin, data: new Date().toISOString(), tenantId: "CRIS", createdAt: serverTimestamp() });
              setDescFin(""); setValorFin(""); loadData();
            }} style={{...btnStyle, backgroundColor: tipoFin==='receita'?'#4caf50':'#f44336'}}>Gravar</button>
          </section>
        </div>
      )}

      {tab === "clientes" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar" : "Novo"} Cliente</h3>
            <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
            <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
            <button onClick={async () => {
              const d = { nome: nomeCliente, telefone };
              if(editId) await updateDoc(doc(db, "clients", editId), d);
              else await addDoc(collection(db, "clients"), { ...d, tenantId: "CRIS", createdAt: serverTimestamp() });
              setEditId(null); setNomeCliente(""); setTelefone(""); loadData();
            }} style={btnStyle}>Salvar</button>
            <input type="file" accept=".csv" onChange={handleImportCSV} style={{marginTop:'10px', fontSize:'10px'}} />
          </section>
          <input placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '10px' }}>
            {alfabeto.map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={btnLetter(selectedLetter === l)}>{l}</button>)}
            <button onClick={() => setSelectedLetter("")} style={btnLetter(selectedLetter === "")}>Tudo</button>
          </div>
          {clientesFiltrados.map(c => (
            <div key={c.id} style={itemStyle}>
              <span>{c.nome}</span>
              <div>
                <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome); setTelefone(c.telefone)}} style={btnEdit}>✏️</button>
                <button onClick={() => deleteItem("clients", c.id)} style={btnDel}>🗑️</button>
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
            <button onClick={async () => {
              await addDoc(collection(db, "services"), { nome: nomeServico, preco: Number(preco), tenantId: "CRIS", createdAt: serverTimestamp() });
              setNomeServico(""); setPreco(""); loadData();
            }} style={btnStyle}>Adicionar</button>
          </section>
          {services.map(s => <div key={s.id} style={itemStyle}>{s.nome} - R${s.preco}</div>)}
        </div>
      )}

      {/* MODAL DE AGENDAMENTO COM BUSCA DIFERENCIADA */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>{selHora}:00 - Agendar</h3>
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
              <option value="">Serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <button onClick={async () => {
              const dFinal = new Date(selectedDate); dFinal.setHours(selHora, 0, 0, 0);
              const d = { clientId: selCliente, serviceId: selServico, dataHora: dFinal.toISOString(), status: "pendente", tenantId: "CRIS" };
              if(editAppId) await updateDoc(doc(db, "appointments", editAppId), d);
              else await addDoc(collection(db, "appointments"), { ...d, createdAt: serverTimestamp() });
              setShowModal(false); loadData();
            }} style={btnStyle}>Confirmar</button>
            <button onClick={() => setShowModal(false)} style={{...btnStyle, backgroundColor:'#ccc', marginTop:'5px'}}>Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos
const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' });
const btnMini = { padding: '5px 15px', backgroundColor: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: '12px', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#d81b60' };
const itemStyle = { display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px' };
const cardStyle = { padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #eee' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '350px' };
const dropdownStyle = { position: 'absolute', top: '45px', left: 0, width: '100%', backgroundColor: '#fff', border: '1px solid #ccc', zIndex: 10, maxHeight: '100px', overflowY: 'auto' };
const dropdownItem = { padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' };
const btnPay = { backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 10px', marginLeft: '5px' };
const btnDel = { backgroundColor: '#ffcdd2', color: '#c62828', border: 'none', borderRadius: '5px', padding: '5px 10px', marginLeft: '5px' };
const btnEdit = { backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', borderRadius: '5px', padding: '5px 10px' };
const btnLetter = (active) => ({ padding: '3px', minWidth: '20px', fontSize: '9px', backgroundColor: active ? '#d81b60' : '#f0f0f0', color: active ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' });
