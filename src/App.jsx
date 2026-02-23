import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [tab, setTab] = useState("agenda"); // Começar logo na agenda
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  
  // Estados para os formulários
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");

  // Estados para o Agendamento
  const [selCliente, setSelCliente] = useState("");
  const [selServico, setSelServico] = useState("");
  const [dataHora, setDataHora] = useState("");

  async function loadData() {
    const queryClients = await getDocs(collection(db, "clients"));
    setClients(queryClients.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const queryServices = await getDocs(collection(db, "services"));
    setServices(queryServices.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const queryApps = await getDocs(collection(db, "appointments"));
    setAppointments(queryApps.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  useEffect(() => { loadData(); }, []);

  const handleAddClient = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "clients"), { nome: nomeCliente, telefone, tenantId: "ID_DA_CRIS", createdAt: serverTimestamp() });
    setNomeCliente(""); setTelefone(""); loadData();
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "services"), { nome: nomeServico, preco: Number(preco), duracao: Number(duracao), tenantId: "ID_DA_CRIS", createdAt: serverTimestamp() });
    setNomeServico(""); setPreco(""); setDuracao(""); loadData();
  };

  // Função para Salvar Agendamento
  const handleAddAppointment = async (e) => {
    e.preventDefault();
    if (!selCliente || !selServico || !dataHora) return alert("Preencha todos os campos!");

    await addDoc(collection(db, "appointments"), {
      clientId: selCliente,
      serviceId: selServico,
      dataHora: dataHora,
      status: "confirmado",
      tenantId: "ID_DA_CRIS",
      createdAt: serverTimestamp()
    });

    setSelCliente(""); setSelServico(""); setDataHora(""); loadData();
    alert("Agendamento realizado!");
  };

  // Função para encontrar nome do cliente/serviço na lista
  const getNome = (lista, id) => lista.find(item => item.id === id)?.nome || "Não encontrado";

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
      <h1 style={{ color: '#d81b60', textAlign: 'center' }}>Pragendar</h1>
      
      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto' }}>
        <button onClick={() => setTab("agenda")} style={btnTab(tab === "agenda")}>Agenda</button>
        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>
        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>
      </div>

      {tab === "agenda" && (
        <div>
          <section style={cardStyle}>
            <h3>Novo Agendamento</h3>
            <form onSubmit={handleAddAppointment}>
              <select value={selCliente} onChange={e => setSelCliente(e.target.value)} style={inputStyle}>
                <option value="">Selecione a Cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              
              <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
                <option value="">Selecione o Serviço</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.preco}€)</option>)}
              </select>

              <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Marcar Horário</button>
            </form>
          </section>

          <h3>Próximos Atendimentos</h3>
          {appointments.sort((a,b) => a.dataHora.localeCompare(b.dataHora)).map(app => (
            <div key={app.id} style={itemStyle}>
              <strong>{new Date(app.dataHora).toLocaleString('pt-PT')}</strong><br/>
              {getNome(clients, app.clientId)} - {getNome(services, app.serviceId)}
            </div>
          ))}
        </div>
      )}

      {tab === "clientes" && (
        <div>
          <section style={cardStyle}>
            <h3>Nova Cliente</h3>
            <form onSubmit={handleAddClient}>
              <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
              <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Guardar Cliente</button>
            </form>
          </section>
          {clients.map(c => <div key={c.id} style={itemStyle}><strong>{c.nome}</strong> - {c.telefone}</div>)}
        </div>
      )}

      {tab === "servicos" && (
        <div>
          <section style={cardStyle}>
            <h3>Novo Serviço</h3>
            <form onSubmit={handleAddService}>
              <input placeholder="Nome do Serviço" value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
              <input placeholder="Preço (€)" type="number" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />
              <input placeholder="Duração (min)" type="number" value={duracao} onChange={e => setDuracao(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Guardar Serviço</button>
            </form>
          </section>
          {services.map(s => <div key={s.id} style={itemStyle}><strong>{s.nome}</strong> - {s.preco}€</div>)}
        </div>
      )}
    </div>
  );
}

const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' });
const cardStyle = { backgroundColor: '#fce4ec', padding: '15px', borderRadius: '10px', marginBottom: '20px' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: '10px', backgroundColor: '#d81b60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const itemStyle = { padding: '10px', borderBottom: '1px solid #eee' };
