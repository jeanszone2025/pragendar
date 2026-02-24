import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const [editId, setEditId] = useState(null);

  // Estados dos Formulários
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [selCliente, setSelCliente] = useState("");
  const [selServico, setSelServico] = useState("");
  const [dataHora, setDataHora] = useState("");

  // Estados Financeiros (Lançamentos Manuais)
  const [descFin, setDescFin] = useState("");
  const [valorFin, setValorFin] = useState("");
  const [tipoFin, setTipoFin] = useState("receita");
  const [formaPgto, setFormaPgto] = useState("pix");

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

  // --- LÓGICA DE PAGAMENTO DE AGENDAMENTO ---
  const handleConfirmPayment = async (app) => {
    const servico = services.find(s => s.id === app.serviceId);
    const cliente = clients.find(c => c.id === app.clientId);
    const valor = servico ? servico.preco : 0;

    try {
      // 1. Criar a Transação Financeira
      await addDoc(collection(db, "transactions"), {
        descricao: `Atendimento: ${cliente?.nome || 'Cliente'} (${servico?.nome || 'Serviço'})`,
        valor: valor,
        tipo: "receita",
        formaPagamento: "pix", // Padrão inicial
        data: new Date().toISOString(),
        tenantId: "CRIS",
        appointmentId: app.id,
        createdAt: serverTimestamp()
      });

      // 2. Atualizar o Status do Agendamento
      await updateDoc(doc(db, "appointments", app.id), {
        status: "pago"
      });

      alert("Pagamento registrado e agendamento concluído!");
      loadData();
    } catch (e) { alert("Erro ao processar pagamento."); }
  };

  // --- LANÇAMENTO MANUAL (DESPESAS/OUTROS) ---
  const handleTransaction = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "transactions"), {
      descricao: descFin,
      valor: Number(valorFin),
      tipo: tipoFin,
      formaPagamento: formaPgto,
      data: new Date().toISOString(),
      tenantId: "CRIS",
      createdAt: serverTimestamp()
    });
    setDescFin(""); setValorFin(""); loadData();
    alert("Lançamento efetuado!");
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

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto', color: '#333' }}>
      <h1 style={{ color: '#d81b60', textAlign: 'center' }}>Pragendar R$</h1>
      
      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', overflowX: 'auto' }}>
        <button onClick={() => setTab("agenda")} style={btnTab(tab === "agenda")}>Agenda</button>
        <button onClick={() => setTab("financeiro")} style={btnTab(tab === "financeiro")}>Financeiro</button>
        <button onClick={() => setTab("clientes")} style={btnTab(tab === "clientes")}>Clientes</button>
        <button onClick={() => setTab("servicos")} style={btnTab(tab === "servicos")}>Serviços</button>
      </div>

      {tab === "agenda" && (
        <div>
          <section style={cardStyle}>
            <h3>Novo Agendamento</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await addDoc(collection(db, "appointments"), { clientId: selCliente, serviceId: selServico, dataHora, status: "pendente", tenantId: "CRIS", createdAt: serverTimestamp() });
              setSelCliente(""); setSelServico(""); setDataHora(""); loadData();
            }}>
              <select value={selCliente} onChange={e => setSelCliente(e.target.value)} style={inputStyle}>
                <option value="">Selecione a Cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
                <option value="">Selecione o Serviço</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R${s.preco})</option>)}
              </select>
              <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} style={inputStyle} />
              <button type="submit" style={btnStyle}>Agendar</button>
            </form>
          </section>

          <h3>Próximos Atendimentos</h3>
          {appointments.sort((a,b) => a.dataHora.localeCompare(b.dataHora)).map(app => (
            <div key={app.id} style={{ ...itemStyle, borderLeft: app.status === 'pago' ? '5px solid #4caf50' : '5px solid #ff9800' }}>
              <div style={{ flex: 1 }}>
                <strong>{new Date(app.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong><br/>
                {getNome(clients, app.clientId)} - <small>{getNome(services, app.serviceId)}</small>
              </div>
              <div>
                {app.status === "pago" ? (
                  <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '12px' }}>PAGO ✅</span>
                ) : (
                  <button onClick={() => handleConfirmPayment(app)} style={btnPay}>Receber R$</button>
                )}
                <button onClick={() => deleteDoc(doc(db, "appointments", app.id)).then(loadData)} style={btnDel}>X</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "financeiro" && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div style={{ ...cardStyle, textAlign: 'center', backgroundColor: '#e8f5e9' }}>
              <small>Entradas Hoje</small>
              <h2 style={{ margin: 0, color: '#2e7d32' }}>R$ {calcTotal("receita", "hoje")}</h2>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center', backgroundColor: '#f3e5f5' }}>
              <small>Entradas Mês</small>
              <h2 style={{ margin: 0, color: '#7b1fa2' }}>R$ {calcTotal("receita", "mes")}</h2>
            </div>
          </div>

          <section style={cardStyle}>
            <h3>Lançamento Manual (Despesa/Outros)</h3>
            <form onSubmit={handleTransaction}>
              <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={inputStyle}>
                <option value="receita">Receita (Entrada)</option>
                <option value="despesa">Despesa (Saída)</option>
              </select>
              <input placeholder="Ex: Compra de Esmaltes" value={descFin} onChange={e => setDescFin(e.target.value)} style={inputStyle} />
              <input placeholder="Valor R$" type="number" value={valorFin} onChange={e => setValorFin(e.target.value)} style={inputStyle} />
              <button type="submit" style={{ ...btnStyle, backgroundColor: tipoFin === 'receita' ? '#4caf50' : '#f44336' }}>Registrar</button>
            </form>
          </section>

          <h3>Histórico</h3>
          {transactions.sort((a,b) => b.data.localeCompare(a.data)).map(t => (
            <div key={t.id} style={itemStyle}>
              <small>{new Date(t.data).toLocaleDateString('pt-BR')} - {t.descricao}</small>
              <strong style={{ color: t.tipo === 'receita' ? '#2e7d32' : '#c62828' }}>
                {t.tipo === 'receita' ? '+' : '-'} R$ {t.valor}
              </strong>
            </div>
          ))}
        </div>
      )}
      {/* Abas de Clientes e Serviços permanecem no código original */}
    </div>
  );
}

// Estilos Adicionais
const btnTab = (active) => ({ flex: 1, padding: '10px', backgroundColor: active ? '#d81b60' : '#eee', color: active ? 'white' : 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' });
const cardStyle = { backgroundColor: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #eee' };
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle = { width: '100%', padding: '12px', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const itemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', marginBottom: '5px', backgroundColor: '#fafafa' };
const btnPay = { backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px', fontSize: '11px' };
const btnDel = { backgroundColor: '#ffcdd2', color: '#c62828', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' };
