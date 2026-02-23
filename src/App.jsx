import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [clients, setClients] = useState([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  // Função para buscar clientes do banco
  async function loadClients() {
    const querySnapshot = await getDocs(collection(db, "clients"));
    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setClients(data);
  }

  useEffect(() => {
    loadClients();
  }, []);

  // Função para salvar um novo cliente
  async function handleAddClient(e) {
    e.preventDefault();
    if (!nome || !telefone) return alert("Preencha tudo!");

    try {
      await addDoc(collection(db, "clients"), {
        nome: nome,
        telefone: telefone,
        tenantId: "ID_DA_CRIS", // Depois vamos deixar isso automático
        createdAt: serverTimestamp()
      });
      
      setNome(""); // Limpa o campo
      setTelefone(""); // Limpa o campo
      loadClients(); // Atualiza a lista na tela
      alert("Cliente cadastrada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '400px', margin: 'auto' }}>
      <h1 style={{ color: '#d81b60' }}>Pragendar</h1>
      
      <div style={{ backgroundColor: '#fce4ec', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
        <h3>Nova Cliente</h3>
        <form onSubmit={handleAddClient}>
          <input 
            placeholder="Nome da cliente" 
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
          <input 
            placeholder="Telefone (WhatsApp)" 
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#d81b60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Cadastrar
          </button>
        </form>
      </div>

      <h2>Lista de Clientes</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {clients.map(client => (
          <li key={client.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
            <strong>{client.nome}</strong> <br />
            <small>{client.telefone}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
