import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  
  const [editId, setEditId] = useState(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [selCliente, setSelCliente] = useState("");
  const [selServico, setSelServico] = useState("");
  const [dataHora, setDataHora] = useState("");

  async function loadData() {
    try {
      const queryClients = await getDocs(collection(db, "clients"));
      setClients(queryClients.docs.map(d => ({ id: d.id, ...d.data() })));
      const queryServices = await getDocs(collection(db, "services"));
      setServices(queryServices.docs.map(d => ({ id: d.id, ...d.data() })));
      const queryApps = await getDocs(collection(db, "appointments"));
      setAppointments(queryApps.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); }
  }

  useEffect(() => { loadData(); }, []);

  // --- NOVA FUNÇÃO: IMPORTAR CSV ---
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split("\n");
      const batch = writeBatch(db); // Batch permite salvar vários de uma vez (mais rápido)

      // Ignora o cabeçalho e percorre as linhas
      lines.slice(1).forEach((line) => {
        const columns = line.split(","); // Ajuste para ";" se seu CSV usar ponto e vírgula
        if (columns.length >= 2) {
          const nome = columns[0].trim().replace(/"/g, "");
          const fone = columns[1].trim().replace(/"/g, "");
          
          if (nome) {
            const newClientRef = doc(collection(db, "clients"));
            batch.set(newClientRef, {
              nome: nome,
              telefone: fone,
              tenantId: "CRIS",
              createdAt: serverTimestamp()
            });
          }
        }
      });

      await batch.commit();
      alert("Contatos importados com sucesso!");
      loadData();
    };
    reader.readAsText(file);
  };

  const handleClient = async (e) => {
    e.preventDefault();
    const data = { nome: nomeCliente, telefone, updatedAt: serverTimestamp() };
    if (editId) {
      await updateDoc(doc(db, "clients", editId), data);
      setEditId(null);
    } else {
      await addDoc(collection(db, "clients"), { ...data, tenantId: "CRIS", createdAt: serverTimestamp() });
    }
    setNomeCliente(""); setTelefone(""); loadData();
  };

  const handleService = async (e) => {
    e.preventDefault();
    const data = { nome: nomeServico, preco: Number(preco), duracao: Number(duracao), updatedAt: serverTimestamp() };
    if (editId) {
      await updateDoc(doc(db, "services", editId), data);
      setEditId(null);
    } else {
      await addDoc(collection(db, "services"), { ...data, tenantId: "CRIS", createdAt: serverTimestamp() });
    }
    setNomeServico(""); setPreco(""); setDuracao(""); loadData();
  };

  const handleAppointment = async (e) => {
    e.preventDefault();
    const dataC = new Date(dataHora);
    if (dataC.getDay() === 0) return alert("Não atendemos aos domingos!");
    if (dataC.getMinutes() !== 0) return alert("Agende apenas horários cheios (ex: 14:00).");
    const data = { clientId: selCliente, serviceId: selServico, dataHora, status: "confirmado" };
    await addDoc(collection(db, "appointments"), { ...data, tenantId: "CRIS", createdAt: serverTimestamp() });
    setSelCliente(""); setSelServico(""); setDataHora(""); loadData();
    alert("Agendado!");
  };

  const deleteItem = async (col, id) => {
    if (window.confirm("Confirmar exclusão?")) {
      await deleteDoc(doc(db, col, id));
      loadData();
    }
  };

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto', color: '#333' }}>
      <h1 style={{ color: '#d81b60', textAlign: 'center' }}>Pragendar R$</h1>
      
      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto' }}>
        <button onClick={() => setTab("agenda")} style={btnTab(tab === "agenda")}>Agenda</button>
        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>
        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>
      </div>

      {tab === "agenda" && (
        <div>
          <section style={cardStyle}>
            <h3>Novo Agendamento</h3>
            <form onSubmit={handleAppointment}>
              <select value={selCliente} onChange={e => setSelCliente(e.target.value)} style={inputStyle}>
                <option value="">Selecione a Cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
                <option value="">Selecione o Serviço</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R${s.preco})</option>)}
              </select>
              <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Confirmar</button>
            </form>
          </section>
          {appointments.sort((a,b) => a.dataHora.localeCompare(b.dataHora)).map(app => (
            <div key={app.id} style={itemStyle}>
              <div>
                <strong>{new Date(app.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong><br/>
                {getNome(clients, app.clientId)} - <span style={{color: '#d81b60'}}>{getNome(services, app.serviceId)}</span>
              </div>
              <button onClick={() => deleteItem("appointments", app.id)} style={btnDel}>Desmarcar</button>
            </div>
          ))}
        </div>
      )}

      {tab === "clientes" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar Cliente" : "Nova Cliente"}</h3>
            <form onSubmit={handleClient}>
              <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
              <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>{editId ? "Salvar" : "Cadastrar"}</button>
            </form>
            
            {!editId && (
              <div style={{marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '10px'}}>
                <label style={{fontSize: '12px', display: 'block', marginBottom: '5px'}}>Importar contatos (CSV):</label>
                <input type="file" accept=".csv" onChange={handleImportCSV} style={{fontSize: '12px'}} />
              </div>
            )}
          </section>
          {clients.map(c => (
            <div key={c.id} style={itemStyle}>
              <span>{c.nome} - {c.telefone}</span>
              <div>
                <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome); setTelefone(c.telefone)}} style={btnEdit}>✏️</button>
                <button onClick={() => deleteItem("clients", c.id)} style={btnDel}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aba de Serviços mantida igual */}
      {tab === "servicos" && (
        <div>
          <section style={cardStyle}>
            <h3>{editId ? "Editar Serviço" : "Novo Serviço"}</h3>
            <form onSubmit={handleService}>
              <input placeholder="Nome" value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
              <input placeholder="Preço (R$)" type="number" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />
              <input placeholder="Duração (min)" type="number" value={duracao} onChange={e => setDuracao(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Salvar</button>
            </form>
          </section>
          {services.map(s => (
            <div key={s.id} style={itemStyle}>
              <span>{s.nome} - R${s.preco}</span>
              <div>
                <button onClick={() => {setEditId(s.id); setNomeServico(s.nome); setPreco(s.preco); setDuracao(s.duracao)}} style={btnEdit}>✏️</button>
                <button onClick={() => deleteItem("services", s.id)} style={btnDel}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer' });
const cardStyle = { backgroundColor: '#fff0f5', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #f8bbd0' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: '12px', backgroundColor: '#d81b60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const itemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' };
const btnDel = { backgroundColor: '#ffcdd2', color: '#c62828', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' };
const btnEdit = { backgroundColor: '#e1f5fe', color: '#0277bd', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' };
