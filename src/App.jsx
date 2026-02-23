import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [tab, setTab] = useState("clientes"); // Alternar entre Clientes e Serviços
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  
  // Estados para os formulários
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");

  // Carregar dados do Firebase
  async function loadData() {
    const queryClients = await getDocs(collection(db, "clients"));
    setClients(queryClients.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const queryServices = await getDocs(collection(db, "services"));
    setServices(queryServices.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  useEffect(() => { loadData(); }, []);

  // Salvar Cliente
  async function handleAddClient(e) {
    e.preventDefault();
    await addDoc(collection(db, "clients"), {
      nome: nomeCliente, telefone, tenantId: "ID_DA_CRIS", createdAt: serverTimestamp()
    });
    setNomeCliente(""); setTelefone(""); loadData();
    alert("Cliente guardada!");
  }

  // Salvar Serviço
  async function handleAddService(e) {
    e.preventDefault();
    await addDoc(collection(db, "services"), {
      nome: nomeServico, 
      preco: Number(preco), 
      duracao: Number(duracao), 
      tenantId: "ID_DA_CRIS", 
      createdAt: serverTimestamp()
    });
    setNomeServico(""); setPreco(""); setDuracao(""); loadData();
    alert("Serviço guardado!");
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
      <h1 style={{ color: '#d81b60', textAlign: 'center' }}>Pragendar</h1>
      
      {/* Menu de Abas */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>
        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>
      </div>

      {tab === "clientes" ? (
        <div>
          <section style={cardStyle}>
            <h3>Nova Cliente</h3>
            <form onSubmit={handleAddClient}>
              <input placeholder="Nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
              <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Guardar Cliente</button>
            </form>
          </section>
          <h3>Lista de Clientes</h3>
          {clients.map(c => <div key={c.id} style={itemStyle}><strong>{c.nome}</strong> - {c.telefone}</div>)}
        </div>
      ) : (
        <div>
          <section style={cardStyle}>
            <h3>Novo Serviço</h3>
            <form onSubmit={handleAddService}>
              <input placeholder="Nome do Serviço (ex: Pé e Mão)" value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
              <input placeholder="Preço (€)" type="number" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />
              <input placeholder="Duração (minutos)" type="number" value={duracao} onChange={e => setDuracao(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Guardar Serviço</button>
            </form>
          </section>
          <h3>Serviços Ativos</h3>
          {services.map(s => <div key={s.id} style={itemStyle}><strong>{s.nome}</strong> - {s.preco}€ ({s.duracao} min)</div>)}
        </div>
      )}
    </div>
  );
}

// Estilos Simples
const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer' });
const cardStyle = { backgroundColor: '#fce4ec', padding: '15px', borderRadius: '10px', marginBottom: '20px' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: '10px', backgroundColor: '#d81b60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const itemStyle = { padding: '10px', borderBottom: '1px solid #eee' };
