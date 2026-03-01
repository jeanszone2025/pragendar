function PaginaAgendamentoCliente({ tenantId }) {
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  
  // Dados da Cliente
  const [clientPhone, setClientPhone] = useState("");
  const [clientData, setClientData] = useState({ 
    nome: "", endereco: "", nascimento: "", email: "" 
  });
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [isExistingClient, setIsExistingClient] = useState(false);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Serviço, 2: Data/Hora, 3: Identificação/Cadastro, 4: Pagamento
  const [appointments, setAppointments] = useState([]);

  // ... (mantenha o modernTheme e useEffect de carregamento que você já fez)

  // 🆕 FUNÇÃO PARA VERIFICAR SE A CLIENTE JÁ EXISTE NO CSV/BANCO DA CRIS
  const verificarCliente = async () => {
    if (!clientPhone.trim()) return alert("Insira seu WhatsApp");
    
    try {
      // Busca no banco de clientes da Cris pelo telefone
      const q = query(
        collection(db, "clients"), 
        where("tenantId", "==", tenantId), 
        where("telefone", "==", clientPhone)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Cliente já existe! Pega o nome dela e pula o cadastro
        const dados = querySnapshot.docs[0].data();
        setClientData({ ...clientData, nome: dados.nome });
        setIsExistingClient(true);
        setStep(4); // Vai direto para o pagamento/resumo
      } else {
        // Cliente nova, precisa preencher tudo
        setIsExistingClient(false);
        setStep(3); 
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinalizar = async () => {
    if (!termosAceitos && !isExistingClient) return alert("Você precisa aceitar os termos de uso.");
    
    const dataHora = new Date(selectedDate);
    dataHora.setHours(selectedTime, 0, 0, 0);

    try {
      // Se for nova, salva ela na lista de clientes da Cris primeiro
      if (!isExistingClient) {
        await addDoc(collection(db, "clients"), {
          nome: clientData.nome,
          telefone: clientPhone,
          endereco: clientData.endereco,
          nascimento: clientData.nascimento,
          tenantId: tenantId,
          createdAt: serverTimestamp()
        });
      }

      // Salva o agendamento
      await addDoc(collection(db, "appointments"), {
        clientPhone,
        clientName: clientData.nome,
        serviceId: selectedService.id,
        dataHora: dataHora.toISOString(),
        status: "pendente", // Só vira confirmado quando a Cris receber o sinal
        tenantId: tenantId,
        valorSinal: (selectedService.preco * (profile?.porcentagemSinal || 30)) / 100
      });

      setStep(5); // Tela de PIX
    } catch (e) { alert(e.message); }
  };

  // ... (Rederização dos passos 1 e 2 iguais aos seus)

  return (
    <div style={{ /* seus estilos */ }}>
      {/* PASSO 3: IDENTIFICAÇÃO (WHATSAPP) */}
      {step === 2 && selectedTime && (
        <div style={cardStyle}>
          <h2>📱 Para continuar, informe seu WhatsApp</h2>
          <input 
            placeholder="Ex: 11999999999" 
            value={clientPhone} 
            onChange={e => setClientPhone(e.target.value)} 
            style={inputStyle} 
          />
          <button onClick={verificarCliente} style={btnStyle}>Verificar Horário</button>
        </div>
      )}

      {/* PASSO 3.5: CADASTRO COMPLETO (SÓ PARA NOVAS) */}
      {step === 3 && (
        <div style={cardStyle}>
          <h2>🎁 Vimos que é sua primeira vez!</h2>
          <p>Preencha os dados para garantir seu seguro e fidelidade:</p>
          <input placeholder="Nome Completo *" onChange={e => setClientData({...clientData, nome: e.target.value})} style={inputStyle} />
          <input placeholder="Endereço Completo *" onChange={e => setClientData({...clientData, endereco: e.target.value})} style={inputStyle} />
          <label style={labelStyle}>Data de Nascimento (Ganhamos mimos no niver! 🎂)</label>
          <input type="date" onChange={e => setClientData({...clientData, nascimento: e.target.value})} style={inputStyle} />
          
          <div style={{ backgroundColor: "#f0f0f0", padding: "10px", borderRadius: "8px", fontSize: "11px", marginBottom: "15px" }}>
             <input type="checkbox" checked={termosAceitos} onChange={() => setTermosAceitos(!termosAceitos)} />
             <strong> Aceito os Termos:</strong> {profile?.termosUso}
          </div>

          <button onClick={() => setStep(4)} style={btnStyle}>Revisar Agendamento</button>
        </div>
      )}

      {/* PASSO 4: RESUMO E PIX (Igual ao seu passo 4, usando profile.chavePix) */}
    </div>
  );
}
