import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    async function loadClients() {
      const querySnapshot = await getDocs(collection(db, "clients"));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClients(data);
    }

    loadClients();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Pragendar</h1>
      <h2>Clientes</h2>

      {clients.length === 0 && <p>Nenhum cliente encontrado.</p>}

      <ul>
        {clients.map(client => (
          <li key={client.id}>
            {client.nome} - {client.telefone}
          </li>
        ))}
      </ul>
    </div>
  );
}
