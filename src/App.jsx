import { useEffect, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  collection, getDocs, addDoc, deleteDoc, updateDoc, 
  doc, query, where, setDoc, getDoc, writeBatch, serverTimestamp 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut 
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "./firebase";
// 🟢 COLE ISSO AQUI (Aproximadamente linha 15)
const TEMAS = {
  premium: {
    id: "premium",
    nome: "Ametista & Mármore",
    primary: "#6b4f7a",
    secondary: "#b89b6a",
    background: "#f5f5f2",
    backgroundImage: "url('https://firebasestorage.googleapis.com/v0/b/teste-pra-agendar.firebasestorage.app/o/4988233506899037035.jpg?alt=media&token=f4b6ba30-4e56-4623-8e09-2e7227db5f39')",
    card: "rgba(255, 255, 255, 0.8)",
    text: "#2c3e50"
  },
  barbearia: {
    id: "barbearia",
    nome: "Industrial & Dark",
    primary: "#2c3e50",
    secondary: "#7f8c8d",
    background: "#1a1a1a",
    backgroundImage: "url('https://firebasestorage.googleapis.com/v0/b/teste-pra-agendar.firebasestorage.app/o/4988233506899037046.jpg?alt=media&token=f5f333ae-f631-4def-bb13-da68e29206f2')",
    card: "#252525",
    text: "#ecf0f1"
  },
  classic: {
    id: "classic",
    nome: "Clean & Soft",
    primary: "#d81b60",
    secondary: "#f06292",
    background: "#fdfbfb",
    backgroundImage: "url('https://firebasestorage.googleapis.com/v0/b/teste-pra-agendar.firebasestorage.app/o/4988233506899037036.jpg?alt=media&token=ce8b15d3-48ef-4689-9c11-51ca2f2a63f3')",
    card: "#ffffff",
    text: "#2d3436"
  }
};
// ========== COMPONENTE: PÁGINA DE AGENDAMENTO PARA CLIENTES ==========
function PaginaAgendamentoCliente({ tenantId }) {
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Serviço, 2: Data/Hora, 3: Confirmação, 4: Pagamento
  const [appointments, setAppointments] = useState([]);
  const [metaClientes, setMetaClientes] = useState(60);

  // Procure onde você definiu o modernTheme e substitua por isso:
const temaId = profile?.themeId || "classic";
const temaAtual = TEMAS[temaId];

const modernTheme = {
  // Aqui pegamos a cor direto do perfil do banco de dados
  primary: profile?.primaryColor || temaAtual.primary, 
  background: temaAtual.background,
  backgroundImage: temaAtual.backgroundImage,
  card: temaAtual.card,
  text: temaAtual.text,
  textLight: "#7f8c8d",
  radius: "16px",
  shadow: "0 8px 32px rgba(0,0,0,0.1)"
};

  useEffect(() => {
    loadPublicProfile();
  }, [tenantId]);

  const loadPublicProfile = async () => {
    try {
      const docRef = doc(db, "profiles", tenantId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setProfile(docSnap.data());

        const qS = await getDocs(query(collection(db, "services"), where("tenantId", "==", tenantId)));
        setServices(qS.docs.map(d => ({ id: d.id, ...d.data() })));

        const qA = await getDocs(query(collection(db, "appointments"), where("tenantId", "==", tenantId)));
        setAppointments(qA.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        alert("❌ Profissional não encontrado!");
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      alert("❌ Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const getHorariosDisponiveis = () => {
  if (!selectedDate || !selectedService || !profile) return [];

  const diaSemana = selectedDate.getDay();
  const configDia = profile.gradeHorarios?.[diaSemana];

  // Se o dia estiver fechado ou não tiver horas selecionadas pela Cris, retorna vazio
  if (!configDia?.aberta || !configDia?.horas || configDia.horas.length === 0) return [];

  return configDia.horas.filter(hora => {
    const dataComparacao = new Date(selectedDate);
    dataComparacao.setHours(hora, 0, 0, 0);

    // 1. Não mostra horas que já passaram (se a cliente estiver olhando para hoje)
    if (dataComparacao < new Date()) return false;

    // 2. Verifica conflito com agendamentos já existentes
    const temConflito = appointments.some(a => {
      const inicio = new Date(a.dataHora);
      const serv = services.find(s => s.id === a.serviceId);
      const dMin = serv ? Number(serv.duracao) : 60;
      
      const hInicio = inicio.getHours();
      // Calcula o fim do serviço para evitar sobreposição
      const hFim = hInicio + (inicio.getMinutes() + dMin) / 60;
      
      return inicio.toDateString() === selectedDate.toDateString() && 
             hora >= hInicio && hora < Math.ceil(hFim);
    });

    return !temConflito;
  });
};

  const handleConfirmarAgendamento = async () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      alert("❌ Preencha nome e telefone!");
      return;
    }

    const dataHora = new Date(selectedDate);
    dataHora.setHours(selectedTime, 0, 0, 0);

    try {
      await addDoc(collection(db, "appointments"), {
        clientId: `temp_${Date.now()}`,
        clientName: clientName,
        clientPhone: clientPhone,
        clientEmail: clientEmail,
        serviceId: selectedService.id,
        dataHora: dataHora.toISOString(),
        status: "pendente",
        tenantId: tenantId,
        signalPaid: false,
        createdAt: serverTimestamp()
      });

      setStep(4); // Vai para pagamento
    } catch (error) {
      alert("❌ Erro ao confirmar: " + error.message);
    }
  };

  const valorSinal = selectedService ? (selectedService.preco * (profile?.porcentagemSinal || 30)) / 100 : 0;
  const valorTotal = selectedService ? selectedService.preco : 0;

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: modernTheme.textLight }}>⏳ Carregando...</div>;
  }

  if (!profile) {
    return <div style={{ textAlign: "center", padding: "40px", color: "red" }}>❌ Profissional não encontrado</div>;
  }

  return (
    <div style={{ backgroundColor: modernTheme.background, minHeight: "100vh", padding: "20px", fontFamily: "sans-serif" }}>
      {/* HEADER */}
      <header style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "20px",
        backgroundColor: modernTheme.card,
        borderRadius: modernTheme.radius,
        marginBottom: "20px",
        boxShadow: modernTheme.shadow
      }}>
        {profile.logoUrl && (
          <img src={profile.logoUrl} alt="Logo" style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} />
        )}
        <div>
          <h1 style={{ margin: 0, color: modernTheme.text, fontSize: "20px", fontWeight: "800" }}>{profile.nomeEmpresa || "Agende seu Horário"}</h1>
          <small style={{ color: modernTheme.textLight }}>Reserva 100% segura com confirmação automática</small>
        </div>
      </header>

      {/* PASSO 1: ESCOLHER SERVIÇO */}
      {step === 1 && (
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ color: modernTheme.text, marginBottom: "15px" }}>1️⃣ Escolha o Serviço</h2>
          {services.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: modernTheme.textLight }}>Nenhum serviço disponível</div>
          ) : (
            services.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedService(s); setStep(2); }}
                style={{
                  padding: "15px",
                  backgroundColor: modernTheme.card,
                  border: `2px solid ${modernTheme.primary}20`,
                  borderRadius: modernTheme.radius,
                  cursor: "pointer",
                  marginBottom: "10px",
                  transition: "all 0.2s ease",
                  boxShadow: modernTheme.shadow
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = modernTheme.primary;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = modernTheme.primary + "20";
                }}
              >
                <strong style={{ color: modernTheme.text }}>{s.nome}</strong>
                <br />
                <small style={{ color: modernTheme.textLight }}>
                  R$ {s.preco.toFixed(2)} • {s.duracao >= 60 ? `${Math.floor(s.duracao / 60)}h ${s.duracao % 60}min` : `${s.duracao}min`}
                </small>
                {s.descricao && <><br /><small style={{ color: modernTheme.textLight }}>{s.descricao}</small></>}
              </div>
            ))
          )}
        </div>
      )}

      {/* PASSO 2: ESCOLHER DATA E HORA */}
      {step === 2 && selectedService && (
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ color: modernTheme.text, marginBottom: "15px" }}>2️⃣ Escolha Data e Hora</h2>

          <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold", color: modernTheme.text }}>📅 Data</label>
          <input
            type="date"
            value={selectedDate ? selectedDate.toISOString().split("T")[0] : ""}
            onChange={(e) => {
              if (e.target.value) {
                const [year, month, day] = e.target.value.split("-");
                setSelectedDate(new Date(year, month - 1, day));
              }
            }}
            min={new Date().toISOString().split("T")[0]}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${modernTheme.primary}40`,
              marginBottom: "15px",
              fontSize: "14px"
            }}
          />

          {selectedDate && (
            <>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold", color: modernTheme.text }}>🕐 Horário</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "15px" }}>
                {getHorariosDisponiveis().map(hora => (
                  <button
                    key={hora}
                    onClick={() => setSelectedTime(hora)}
                    style={{
                      padding: "10px",
                      backgroundColor: selectedTime === hora ? modernTheme.primary : modernTheme.card,
                      color: selectedTime === hora ? "white" : modernTheme.text,
                      border: `2px solid ${modernTheme.primary}40`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {String(hora).padStart(2, "0")}:00
                  </button>
                ))}
              </div>

              {selectedTime !== null && (
                <button
                  onClick={() => setStep(3)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor: modernTheme.primary,
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  ✅ Próximo Passo
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setStep(1)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: modernTheme.textLight + "20",
              color: modernTheme.text,
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            ⬅️ Voltar
          </button>
        </div>
      )}

      {/* PASSO 3: DADOS DA CLIENTE */}
      {step === 3 && selectedService && selectedDate && selectedTime !== null && (
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ color: modernTheme.text, marginBottom: "15px" }}>3️⃣ Seus Dados</h2>

          <input
            placeholder="Nome Completo *"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${modernTheme.primary}40`,
              marginBottom: "12px",
              fontSize: "14px",
              boxSizing: "border-box"
            }}
          />

          <input
            placeholder="Telefone/WhatsApp *"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${modernTheme.primary}40`,
              marginBottom: "12px",
              fontSize: "14px",
              boxSizing: "border-box"
            }}
          />

          <input
            placeholder="E-mail (opcional)"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            type="email"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${modernTheme.primary}40`,
              marginBottom: "15px",
              fontSize: "14px",
              boxSizing: "border-box"
            }}
          />

          {/* RESUMO */}
          <div style={{
            padding: "15px",
            backgroundColor: modernTheme.primary + "10",
            borderLeft: `4px solid ${modernTheme.primary}`,
            borderRadius: "8px",
            marginBottom: "15px"
          }}>
            <strong style={{ color: modernTheme.text }}>📋 Resumo da Reserva:</strong>
            <p style={{ margin: "5px 0", color: modernTheme.text, fontSize: "14px" }}>
              <strong>Serviço:</strong> {selectedService.nome}
            </p>
            <p style={{ margin: "5px 0", color: modernTheme.text, fontSize: "14px" }}>
              <strong>Data/Hora:</strong> {selectedDate.toLocaleDateString("pt-BR")} às {String(selectedTime).padStart(2, "0")}:00
            </p>
            <p style={{ margin: "5px 0", color: modernTheme.text, fontSize: "14px" }}>
              <strong>Valor Total:</strong> R$ {valorTotal.toFixed(2)}
            </p>
          </div>

          {/* TERMOS DE USO */}
          {profile.termosUso && (
            <div style={{
              padding: "12px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: "8px",
              marginBottom: "15px",
              fontSize: "12px",
              color: "#856404",
              maxHeight: "100px",
              overflowY: "auto"
            }}>
              <strong>⚠️ Termos Importantes:</strong>
              <p style={{ margin: "5px 0" }}>{profile.termosUso}</p>
            </div>
          )}

          <button
            onClick={() => handleConfirmarAgendamento()}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: modernTheme.primary,
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              marginBottom: "10px"
            }}
          >
            ✅ Confirmar e Pagar Sinal
          </button>

          <button
            onClick={() => setStep(2)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: modernTheme.textLight + "20",
              color: modernTheme.text,
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            ⬅️ Voltar
          </button>
        </div>
      )}

      {/* PASSO 4: PAGAMENTO DO SINAL */}
      {step === 4 && selectedService && (
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ color: modernTheme.text, marginBottom: "15px" }}>4️⃣ Pague o Sinal</h2>

          <div style={{
            padding: "20px",
            backgroundColor: modernTheme.primary,
            color: "white",
            borderRadius: modernTheme.radius,
            marginBottom: "20px",
            textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 10px 0" }}>Sinal Obrigatório</h3>
            <p style={{ fontSize: "12px", margin: "5px 0" }}>({profile.porcentagemSinal || 30}% do valor total)</p>
            <h1 style={{ margin: "10px 0 0 0", fontSize: "32px" }}>R$ {valorSinal.toFixed(2)}</h1>
          </div>

          <div style={{
            padding: "15px",
            backgroundColor: modernTheme.card,
            border: `2px solid ${modernTheme.primary}40`,
            borderRadius: modernTheme.radius,
            marginBottom: "15px"
          }}>
            <strong style={{ color: modernTheme.text, display: "block", marginBottom: "10px" }}>📲 Escaneie o QR Code ou copie a chave PIX:</strong>
            <div style={{
              padding: "12px",
              backgroundColor: modernTheme.primary + "10",
              borderRadius: "8px",
              wordBreak: "break-all",
              fontFamily: "monospace",
              color: modernTheme.text,
              marginBottom: "10px"
            }}>
              {profile.chavePix || "❌ Chave PIX não cadastrada"}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(profile.chavePix || "");
                alert("✅ Chave PIX copiada!");
              }}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#25D366",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              📋 Copiar Chave PIX
            </button>
          </div>

          {/* INSTRUÇÕES */}
          <div style={{
            padding: "15px",
            backgroundColor: "#e8f5e9",
            border: "1px solid #4caf50",
            borderRadius: "8px",
            marginBottom: "15px",
            fontSize: "13px",
            color: "#2e7d32"
          }}>
            <strong>✅ Depois de pagar:</strong>
            <p style={{ margin: "5px 0" }}>1️⃣ Envie o comprovante de pagamento no WhatsApp para: <strong>{profile.telefoneProfissional}</strong></p>
            <p style={{ margin: "5px 0" }}>2️⃣ Você receberá uma confirmação automática</p>
            <p style={{ margin: "5px 0" }}>3️⃣ Um dia antes, você recebe um lembrete</p>
            <p style={{ margin: "5px 0" }}>4️⃣ Agende seu horário com confiança!</p>
          </div>

          {profile.linkCartao && (
            <div style={{
              padding: "15px",
              backgroundColor: modernTheme.card,
              border: `2px solid ${modernTheme.primary}40`,
              borderRadius: modernTheme.radius,
              marginBottom: "15px"
            }}>
              <strong style={{ color: modernTheme.text, display: "block", marginBottom: "10px" }}>💳 Prefere Cartão?</strong>
              <a
                href={profile.linkCartao}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  width: "100%",
                  padding: "10px",
                  backgroundColor: modernTheme.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  textAlign: "center",
                  textDecoration: "none"
                }}
              >
                💳 Pagar via Cartão
              </a>
            </div>
          )}

          <div style={{
            padding: "12px",
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#856404"
          }}>
            <strong>⚠️ Importante:</strong> O sinal garante sua reserva e NÃO é devolvido em caso de cancelamento. O restante é pago no dia do atendimento.
          </div>
        </div>
      )}
    </div>
  );
}

// ========== COMPONENTE PRINCIPAL: APP DA PROFISSIONAL ==========
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_KEY || "AI_KEY_TESTE");
export default function App() {
  // 1. Verificação de Roteamento para Clientes (SaaS)
  const urlParams = new URLSearchParams(window.location.search);
  const tenantIdPublico = urlParams.get("p");

  if (tenantIdPublico) {
    return <PaginaAgendamentoCliente tenantId={tenantIdPublico} />;
  }

  // 2. Declaração de Estados Globais (Início da Lógica Administrativa)
  const [user, setUser] = useState(null);
  const [authTab, setAuthTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ========== ESTADOS DE DADOS DO SISTEMA ==========
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [profile, setProfile] = useState(null);

  // 🔎 NOVO: Estado para a Busca Geral de Histórico (Feedback Cris)
  const [searchHistory, setSearchHistory] = useState("");

  // 🔎 NOVO: Lógica que filtra agendamentos por nome ou telefone
  const filteredHistory = appointments.filter(app => {
    if (!searchHistory || searchHistory.length < 2) return false;
    const cli = clients.find(c => c.id === app.clientId);
    const termo = searchHistory.toLowerCase();
    return (
      cli?.nome.toLowerCase().includes(termo) || 
      cli?.telefone.includes(termo) ||
      app.clientName?.toLowerCase().includes(termo) // Caso o agendamento não tenha ID de cliente fixo
    );
  }).sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

  // ========== ESTADOS DE INTERFACE E MODAIS ==========
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClientHistoryModal, setShowClientHistoryModal] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState(null);
  const [editAppId, setEditAppId] = useState(null);
  const [selCliente, setSelCliente] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selServico, setSelServico] = useState("");
  const [selHora, setSelHora] = useState("");
  const [editId, setEditId] = useState(null);
  const [selectedAppForPayment, setSelectedAppForPayment] = useState(null);

  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nomeServico, setNomeServico] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [descFin, setDescFin] = useState("");
  const [valorFin, setValorFin] = useState("");
  const [tipoFin, setTipoFin] = useState("receita");
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [dataManualFin, setDataManualFin] = useState(new Date().toISOString().split("T")[0]);
  const [subTipoCartao, setSubTipoCartao] = useState("debito");
  const [descServico, setDescServico] = useState("");
  const [tempoHoras, setTempoHoras] = useState(0);
  const [tempoMinutos, setTempoMinutos] = useState(30);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [telefoneProfissional, setTelefoneProfissional] = useState("");
  const [horarioAbertura, setHorarioAbertura] = useState("09:00");
  const [horarioFechamento, setHorarioFechamento] = useState("19:00");
  const [fidelidadeLimit, setFidelidadeLimit] = useState(10);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [gradeHorarios, setGradeHorarios] = useState({
    0: { aberta: false, horas: [] },
    1: { aberta: true, horas: [9, 10, 11, 14, 15, 16, 17] },
    2: { aberta: true, horas: [9, 10, 11, 14, 15, 16, 17] },
    3: { aberta: true, horas: [9, 10, 11, 14, 15, 16, 17] },
    4: { aberta: true, horas: [9, 10, 11, 14, 15, 16, 17] },
    5: { aberta: true, horas: [9, 10, 11, 14, 15, 16, 17] },
    6: { aberta: false, horas: [] }
  });

  const [importingCSV, setImportingCSV] = useState(false);
  const [nomeProduto, setNomeProduto] = useState("");
  const [qtdProduto, setQtdProduto] = useState("");
  const [alerta, setAlerta] = useState("");
  const [editProductId, setEditProductId] = useState(null);

  const [primaryColor, setPrimaryColor] = useState("#d81b60");

  const [chavePix, setChavePix] = useState("");
  const [linkCartao, setLinkCartao] = useState("");
  const [porcentagemSinal, setPorcentagemSinal] = useState(30);
  const [termosUso, setTermosUso] = useState("O não comparecimento implica na perda do sinal.");

  const [showAI, setShowAI] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("Olá! Sou sua Gerente Virtual.");
  const [aiChatHistory, setAiChatHistory] = useState([]);

  // ========== THEME ENGINE ==========
  // ========== THEME ENGINE DINÂMICO ==========
const temaIdAdmin = profile?.themeId || "classic";
const temaAtualAdmin = TEMAS[temaIdAdmin];

const modernTheme = {
  primary: primaryColor,
  primaryLight: primaryColor + "20",
  background: temaAtualAdmin.background,
  backgroundImage: temaAtualAdmin.backgroundImage, 
  card: temaAtualAdmin.card,
  text: temaAtualAdmin.text,
  textMuted: "#95a5a6",
  danger: "#e74c3c",
  success: "#27ae60",
  warning: "#f1c40f",
  info: "#3498db",
  shadow: "0 4px 15px rgba(0,0,0,0.08)",
  shadowHeavy: "0 8px 25px rgba(0,0,0,0.15)",
  radius: "12px",
  radiusSmall: "8px",
  radiusTiny: "6px"
};

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        loadData(loggedUser.uid);
        loadProfile(loggedUser.uid);
      }
    });
    return unsub;
  }, []);

  // ... (handleAuth e loadData continuam abaixo)

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authTab === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail("");
      setPassword("");
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  async function loadData(uid) {
    try {
      if (!uid) return;

      const qC = await getDocs(query(collection(db, "clients"), where("tenantId", "==", uid)));
      setClients(qC.docs.map(d => ({ id: d.id, ...d.data() })));

      const qS = await getDocs(query(collection(db, "services"), where("tenantId", "==", uid)));
      setServices(qS.docs.map(d => ({ id: d.id, ...d.data() })));

      const qA = await getDocs(query(collection(db, "appointments"), where("tenantId", "==", uid)));
      setAppointments(qA.docs.map(d => ({ id: d.id, ...d.data() })));

      const qT = await getDocs(query(collection(db, "transactions"), where("tenantId", "==", uid)));
      setTransactions(qT.docs.map(d => ({ id: d.id, ...d.data() })));

      const qI = await getDocs(query(collection(db, "inventory"), where("tenantId", "==", uid)));
      setInventory(qI.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { 
      console.error("Erro ao carregar dados:", error); 
    }
  }

 // ========== CARREGAR PERFIL ==========
async function loadProfile(uid) {
  try {
    if (!uid) return;
    const docRef = doc(db, "profiles", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // 1. Estados Simples
      setNomeEmpresa(data.nomeEmpresa || "");
      setLogoUrl(data.logoUrl || "");
      setTelefoneProfissional(data.telefoneProfissional || "");
      setHorarioAbertura(data.horarioAbertura || "09:00");
      setHorarioFechamento(data.horarioFechamento || "19:00");
      setFidelidadeLimit(data.fidelidadeLimit || 10);
      setPrimaryColor(data.primaryColor || "#d81b60");
      setMetaClientes(data.metaClientes || 60);

      // 2. 🆕 Dados do SaaS (Sinal e Pagamentos)
      setChavePix(data.chavePix || "");
      setLinkCartao(data.linkCartao || "");
      setPorcentagemSinal(data.porcentagemSinal || 30);
      setTermosUso(data.termosUso || "O não comparecimento implica na perda do sinal.");

      // 3. Tratamento da Grade de Horários (Cérebro da Agenda)
      const gradeTratada = data.gradeHorarios || {};
      for (let i = 0; i < 7; i++) {
        if (!gradeTratada[i]) {
          gradeTratada[i] = { aberta: false, tipo: "janela", horas: [] };
        }
        if (!gradeTratada[i].horas) {
          gradeTratada[i].horas = [];
        }
      }

      setGradeHorarios(gradeTratada);
      setProfile({ id: uid, ...data });
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
  }
}

    const handleFileUpload = async (e) => {
  const file = e.target.files[0];
  if (!file || !user) return;

  // 1. Inicia o carregamento (pode colocar um "Girando..." na tela)
  setUploadingLogo(true);

  try {
    // 2. Define onde a foto vai ficar (Pasta logos / ID único do profissional)
    const storageRef = ref(storage, `logos/${user.uid}`);
    
    // 3. Faz o Upload real para a nuvem
    const snapshot = await uploadBytes(storageRef, file);
    
    // 4. Pergunta para o Firebase: "Qual o link dessa foto que acabei de subir?"
    const url = await getDownloadURL(snapshot.ref);
    
    // 5. Atualiza o "estado" para a foto aparecer no app na hora
    setLogoUrl(url); 
    
    alert("✅ Logo atualizada com sucesso! Não esqueça de Salvar as Alterações.");
  } catch (error) {
    console.error("Erro no upload:", error);
    alert("❌ Erro ao subir imagem. Tente uma foto menor.");
  } finally {
    setUploadingLogo(false);
  }
};

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setImportingCSV(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let content = event.target.result;
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

        const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
                             .map(l => l.trim()).filter(l => l.length > 0);
        
        let totalCount = 0;
        let batch = writeBatch(db);
        let batchCount = 0;

        for (let i = 1; i < lines.length; i++) {
          try {
            const parts = lines[i].split(/[;,]/).map(item => item?.trim());

            if (parts.length > 0) {
              const nomeCompleto = [parts[0], parts[1], parts[2]]
                .filter(Boolean)
                .join(" ");

              let telefoneFinal = parts[3] || parts[4] || "";
              telefoneFinal = telefoneFinal.replace(/[^\d+() -]/g, "");

              if (nomeCompleto && nomeCompleto !== "First Name Middle Name Last Name") {
                const newRef = doc(collection(db, "clients"));
                batch.set(newRef, {
                  nome: nomeCompleto,
                  telefone: telefoneFinal,
                  tenantId: user.uid,
                  createdAt: serverTimestamp()
                });
                
                batchCount++;
                totalCount++;

                if (batchCount === 500) {
                  await batch.commit();
                  batch = writeBatch(db);
                  batchCount = 0;
                  console.log(`✅ ${totalCount} contatos processados...`);
                }
              }
            }
          } catch (err) {
            console.error(`Erro na linha ${i + 1}:`, err);
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        loadData(user.uid);
        alert(`✅ Sucesso! ${totalCount} contatos importados com nomes completos.`);
      } catch (error) {
        alert("❌ Erro ao processar arquivo: " + error.message);
      } finally {
        setImportingCSV(false);
        e.target.value = ""; 
      }
    };

    reader.readAsText(file, "UTF-8");
  };

  const handleSaveProfile = async () => {
    try {
      if (!user) return;

      const docRef = doc(db, "profiles", user.uid);
      await setDoc(docRef, {
        nomeEmpresa,
        logoUrl,
        telefoneProfissional,
        horarioAbertura,
        horarioFechamento,
        fidelidadeLimit,
        gradeHorarios,
        primaryColor,
        // 🆕 SALVAR DADOS DO SaaS
        themeId: profile?.themeId || "classic",
        chavePix,
        linkCartao,
        porcentagemSinal: Number(porcentagemSinal),
        termosUso,
        metaClientes: Number(metaClientes),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setEditingProfile(false);
      loadProfile(user.uid);
      alert("✅ Perfil salvo com sucesso!");
    } catch (error) {
      alert("❌ Erro ao salvar perfil: " + error.message);
    }
  };

  const getAppDoHorario = (hora) => {
    const dSel = new Date(selectedDate);
    return appointments.find(a => {
      const inicio = new Date(a.dataHora);
      const serv = services.find(s => s.id === a.serviceId);
      const dMin = serv ? Number(serv.duracao) : 60;
      const mesmaData = inicio.getDate() === dSel.getDate() && inicio.getMonth() === dSel.getMonth() && inicio.getFullYear() === dSel.getFullYear();
      if (!mesmaData) return false;
      const hInicio = inicio.getHours();
      const hFim = hInicio + (inicio.getMinutes() + dMin) / 60;
      return hora >= hInicio && hora < Math.ceil(hFim);
    });
  };

  const getChartData = () => {
    const dinheiro = transactions.filter(t => t.formaPagamento === "dinheiro" && t.tipo === "receita").reduce((acc, t) => acc + t.valor, 0);
    const cartao = transactions.filter(t => t.formaPagamento === "cartao" && t.tipo === "receita").reduce((acc, t) => acc + t.valor, 0);
    const pix = transactions.filter(t => t.formaPagamento === "pix" && t.tipo === "receita").reduce((acc, t) => acc + t.valor, 0);
    const total = dinheiro + cartao + pix;

    return {
      dinheiro: total > 0 ? ((dinheiro / total) * 100).toFixed(1) : 0,
      cartao: total > 0 ? ((cartao / total) * 100).toFixed(1) : 0,
      pix: total > 0 ? ((pix / total) * 100).toFixed(1) : 0,
      total: total.toFixed(2),
      valores: { dinheiro, cartao, pix }
    };
  };

  const getClientHistory = (clientId) => {
    const clientApps = appointments.filter(a => a.clientId === clientId);
    const appIds = clientApps.map(a => a.id);
    const clientTransactions = transactions.filter(t => appIds.includes(t.appointmentId));
    const totalGasto = clientTransactions.reduce((acc, t) => acc + (t.tipo === "receita" ? t.valor : 0), 0);
    
    return {
      apps: clientApps.sort((a, b) => b.dataHora.localeCompare(a.dataHora)),
      totalGasto,
      count: clientApps.length
    };
  };

  const getClientFidelity = (clientId) => {
    const paidApps = appointments.filter(a => a.clientId === clientId && a.status === "pago");
    const count = paidApps.length;
    const achieved = count >= fidelidadeLimit;
    return { count, achieved, limit: fidelidadeLimit };
  };

  const handleSaveProduct = async () => {
    if (!nomeProduto.trim() || !qtdProduto || !alerta) return alert("Preencha todos os campos");
    try {
      if (editProductId) {
        await updateDoc(doc(db, "inventory", editProductId), {
          nome: nomeProduto,
          quantidade: Number(qtdProduto),
          alertaCritico: Number(alerta),
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, "inventory"), {
          nome: nomeProduto,
          quantidade: Number(qtdProduto),
          alertaCritico: Number(alerta),
          tenantId: user.uid,
          createdAt: new Date().toISOString()
        });
      }
      setNomeProduto("");
      setQtdProduto("");
      setAlerta("");
      setEditProductId(null);
      loadData(user.uid);
    } catch (error) {
      alert("❌ Erro: " + error.message);
    }
  };

  const handlePaymentClick = (app) => {
    setSelectedAppForPayment(app);
    setFormaPagamento("pix");
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedAppForPayment) return;

    const serv = services.find(s => s.id === selectedAppForPayment.serviceId);
    const cli = clients.find(c => c.id === selectedAppForPayment.clientId);
    
    try {
      await addDoc(collection(db, "transactions"), {
        descricao: `Atendimento: ${cli?.nome} (${serv?.nome})`,
        valor: Number(serv?.preco || 0),
        tipo: "receita",
        data: new Date().toISOString(),
        tenantId: user.uid,
        appointmentId: selectedAppForPayment.id,
        formaPagamento: formaPagamento
      });
      await updateDoc(doc(db, "appointments", selectedAppForPayment.id), { status: "pago" });
      loadData(user.uid);
      setShowPaymentModal(false);
      setSelectedAppForPayment(null);
      alert("✅ Pagamento recebido!");
    } catch (error) {
      alert("❌ Erro ao confirmar pagamento: " + error.message);
    }
  };

  const sendWhatsAppReminder = (app) => {
    const cli = clients.find(c => c.id === app.clientId);
    const serv = services.find(s => s.id === app.serviceId);
    
    if (!cli || !cli.telefone) {
      return alert("❌ Esta cliente não possui telefone cadastrado!");
    }

    const dataFmt = new Date(app.dataHora).toLocaleDateString("pt-BR");
    const horaFmt = String(new Date(app.dataHora).getHours()).padStart(2, "0");
    const minFmt = String(new Date(app.dataHora).getMinutes()).padStart(2, "0");
    const nomeS = nomeEmpresa || "Pragendar R$";

    const mensagem = `Olá ${cli.nome}! ✨ Aqui é do ${nomeS}. Passando para confirmar seu horário de *${serv?.nome || "procedimento"}* no dia *${dataFmt}* às *${horaFmt}:${minFmt}h*. Podemos confirmar? 🙏`;

    const foneLimpo = cli.telefone.replace(/\D/g, "");
    const foneFinal = foneLimpo.startsWith("55") ? foneLimpo : `55${foneLimpo}`;
    const link = `https://wa.me/${foneFinal}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(link, "_blank");
  };

  const sendCobrancaWhatsApp = (cliente) => {
    if (!cliente || !cliente.telefone) {
      alert("❌ Cliente não possui telefone cadastrado!");
      return;
    }

    const nomeS = nomeEmpresa || "Pragendar R$";
    const mensagem = `Olá ${cliente.nome}! 👋 Aqui é do ${nomeS}. Há quanto tempo não nos vê? 😊 Saudades! Que tal marcar um horário para você? Temos promoções especiais esperando por você! 💅✨`;

    const foneLimpo = cliente.telefone.replace(/\D/g, "");
    const foneFinal = foneLimpo.startsWith("55") ? foneLimpo : `55${foneLimpo}`;
    const link = `https://wa.me/${foneFinal}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(link, "_blank");
  };
const handleSaveAppointment = async () => {
    if (!selCliente || !selServico) {
      alert("⚠️ Por favor, selecione a cliente e o serviço!");
      return;
    }

    const dataHora = new Date(selectedDate);
    dataHora.setHours(selHora, 0, 0, 0);

    const d = {
      clientId: selCliente,
      serviceId: selServico,
      dataHora: dataHora.toISOString(),
      status: "pendente",
      tenantId: user.uid,
      // Se for um agendamento novo, salvamos quem é a cliente pelo nome também para facilitar
      clientName: getNome(clients, selCliente)
    };

    try {
      if (editAppId) {
        await updateDoc(doc(db, "appointments", editAppId), d);
      } else {
        await addDoc(collection(db, "appointments"), d);
      }
      setShowModal(false);
      loadData(user.uid);
      alert("✅ Agendamento salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      alert("❌ Erro ao salvar. Tente novamente.");
    }
  };
  const handleSaveTransaction = async () => {
    const d = { 
      descricao: descFin, 
      valor: Number(valorFin), 
      tipo: tipoFin, 
      data: new Date(dataManualFin).toISOString(),
      subTipo: subTipoCartao,
      tenantId: user.uid,
      formaPagamento: formaPagamento
    };
    try {
      if (editId) await updateDoc(doc(db, "transactions", editId), d);
      else await addDoc(collection(db, "transactions"), d);
      setEditId(null); 
      setDescFin(""); 
      setValorFin(""); 
      setFormaPagamento("pix");
      loadData(user.uid);
    } catch (error) {
      alert("❌ Erro ao salvar transação: " + error.message);
    }
  };

  const getNome = (list, id) => list.find(i => i.id === id)?.nome || "---";
  const getTel = (list, id) => list.find(i => i.id === id)?.telefone || "";

  const deleteWithConfirm = async (col, id, nome, extra = "") => {
    if (window.confirm(`Tem certeza que deseja excluir ${nome} ${extra ? `(${extra})` : ""}?`)) {
      try {
        await deleteDoc(doc(db, col, id));
        loadData(user.uid);
      } catch (error) {
        alert("❌ Erro ao deletar: " + error.message);
      }
    }
  };

  const printReport = () => {
    const chart = getChartData();
    const dataAtual = new Date().toLocaleDateString("pt-BR");
    const win = window.open("", "relatório");
    const html = `<!DOCTYPE html>
<html>
<head>
<title>Relatório ${nomeEmpresa}</title>
<style>
body { font-family: Arial, sans-serif; padding: 20px; margin: 0; background: white; }
.container { max-width: 900px; margin: 0 auto; }
h1 { text-align: center; color: ${primaryColor}; margin-bottom: 10px; }
.data-relatorio { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
.card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }
.card strong { display: block; color: ${primaryColor}; margin-bottom: 10px; }
.card small { display: block; font-size: 11px; color: #666; margin-top: 5px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th { background: ${primaryColor}; color: white; padding: 12px; text-align: left; font-weight: bold; }
td { border: 1px solid #ddd; padding: 10px; font-size: 12px; }
tr:nth-child(even) { background: #f5f5f5; }
.total-row { font-weight: bold; background: #ffe0ec; }
@media print { body { margin: 0; padding: 0; } .no-print { display: none; } button { display: none; } }
</style>
</head>
<body>
<div class="container">
<h1>${nomeEmpresa || "Pragendar R$"}</h1>
<p class="data-relatorio">Relatório Financeiro de ${dataAtual}</p>
<h2 style="color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 10px;">Resumo Financeiro</h2>
<div class="summary">
<div class="card"><strong>💵 Dinheiro</strong>R$ ${chart.valores.dinheiro.toFixed(2)}<br/><small>${chart.dinheiro}%</small></div>
<div class="card"><strong>💳 Cartão</strong>R$ ${chart.valores.cartao.toFixed(2)}<br/><small>${chart.cartao}%</small></div>
<div class="card"><strong>📲 Pix</strong>R$ ${chart.valores.pix.toFixed(2)}<br/><small>${chart.pix}%</small></div>
</div>
<div style="background: ${primaryColor}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
<h3 style="margin: 0; font-size: 28px;">R$ ${chart.total}</h3>
<small>Total Recebido</small></div>
<h2 style="color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 10px;">Agendamentos Realizados</h2>
<table><thead><tr><th>Data/Hora</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Status</th></tr></thead><tbody>
${appointments.map(a => {
  const serv = services.find(s => s.id === a.serviceId);
  const valor = serv?.preco || 0;
  return `<tr><td>${new Date(a.dataHora).toLocaleDateString("pt-BR")} ${String(new Date(a.dataHora).getHours()).padStart(2, "0")}:${String(new Date(a.dataHora).getMinutes()).padStart(2, "0")}</td><td>${getNome(clients, a.clientId)}</td><td>${getNome(services, a.serviceId)}</td><td>R$ ${valor}</td><td>${a.status === "pago" ? "✅ Pago" : "⏳ Pendente"}</td></tr>`;
}).join("")}
<tr class="total-row"><td colspan="3" style="text-align: right;">TOTAL FATURADO:</td><td colspan="2">R$ ${appointments.filter(a => a.status === "pago").reduce((acc, a) => {
  const serv = services.find(s => s.id === a.serviceId);
  return acc + (serv?.preco || 0);
}, 0).toFixed(2)}</td></tr></tbody></table>
<h2 style="color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 10px; margin-top: 30px;">Resumo de Clientes</h2>
<p style="font-size: 12px; color: #666;">Total de clientes: <strong>${clients.length}</strong> | Total de atendimentos: <strong>${appointments.length}</strong></p>
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 11px;">
<p>Relatório gerado automaticamente pelo Pragendar R$ em ${new Date().toLocaleString("pt-BR")}</p></div></div>
<script>window.print(); window.close();</script></body></html>`;

    win.document.write(html);
    win.document.close();
  };

  const askAI = async (pergunta) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // 1. Criamos um "Resumo" do que está acontecendo no salão para a IA ler
  const dadosDoSalao = `
    Contexto do Salão ${nomeEmpresa}:
    - Clientes cadastrados: ${clients.length}
    - Serviços: ${services.map(s => s.nome + " (R$" + s.preco + ")").join(", ")}
    - Agendamentos hoje: ${appointments.filter(a => new Date(a.dataHora).toLocaleDateString() === new Date().toLocaleDateString()).length}
    - Faturamento total do mês: R$ ${getChartData().total}
    - Produtos em nível crítico: ${inventory.filter(p => Number(p.quantidade) <= Number(p.alertaCritico)).map(p => p.nome).join(", ")}
  `;

  try {
    // 2. O Gemini lê os dados e responde a pergunta da Cris
    const prompt = `Você é a Gerente Virtual do salão da Cris. 
    Use os dados abaixo para responder a pergunta de forma curta e amigável.
    
    ${dadosDoSalao}
    
    Pergunta da Cris: "${pergunta}"`;

    const result = await model.generateContent(prompt);
    const respostaIA = result.response.text();

    setAiChatHistory([...aiChatHistory, { pergunta, resposta: respostaIA, timestamp: new Date() }]);
    setAiResponse(respostaIA);
    return respostaIA;

  } catch (error) {
    console.error("Erro na IA:", error);
    return "Ops, tive um pequeno curto-circuito. Pode perguntar de novo?";
  }
};

  const processAgendaImage = async (file) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imageData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    const prompt = `Analise esta foto de uma agenda de papel. 
      Extraia: Nome da Cliente, Serviço e Horário. 
      Retorne APENAS um JSON no formato: 
      [{"nome": "Maria", "servico": "Corte", "hora": 14, "data": "2026-03-01"}] 
      Se não entender algo, ignore. Use a data de hoje como padrão se não houver data.`;

    try {
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageData, mimeType: file.type } }
      ]);
      
      const rawResponse = result.response.text();
      const cleanJson = rawResponse.replace(/```json|```/g, "");
      const appointmentsFound = JSON.parse(cleanJson);

      for (const app of appointmentsFound) {
        const clienteExiste = clients.find(c => c.nome.toLowerCase().includes(app.nome.toLowerCase()));
        let clientId = clienteExiste ? clienteExiste.id : `temp_${Date.now()}`;

        const dataFinal = new Date(app.data);
        dataFinal.setHours(app.hora, 0, 0, 0);

        await addDoc(collection(db, "appointments"), {
          clientId,
          clientName: app.nome,
          serviceId: services[0]?.id || "", 
          dataHora: dataFinal.toISOString(),
          status: "pendente",
          tenantId: user.uid,
          source: "ia_foto"
        });
      }

      setAiResponse(`✅ Encontrei ${appointmentsFound.length} agendamentos na foto e já salvei tudo!`);
      loadData(user.uid);

    } catch (error) {
      setAiResponse("❌ Ops, não consegui ler bem a foto. Tente uma imagem mais nítida!");
      console.error(error);
    }
  };

  if (!user) {
  return (
    <div style={{ 
      padding: "40px 20px", 
      fontFamily: "'Inter', sans-serif", 
      textAlign: "center", 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      justifyContent: "center", 
      alignItems: "center", 
      // Fundo inspirado na textura de mármore e tons navy/gold
      background: `linear-gradient(135deg, #f5f5f2 0%, #e0dcd3 100%)`,
      backgroundImage: `url('https://www.transparenttextures.com/patterns/white-marble.png')` 
    }}>
      {/* 1. IMAGEM DA LOGOMARCA (Substituindo o texto) */}
      <img 
        src="https://firebasestorage.googleapis.com/v0/b/teste-pra-agendar.firebasestorage.app/o/4979208921616682355.png?alt=media&token=fd9fe2fc-1001-484b-a501-bd95d1241f5a" 
        alt="Pra agendar" 
        style={{ width: "220px", marginBottom: "30px", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.1))" }} 
      />

      {/* 2. CARD DE LOGIN ESTILO PREMIUM */}
      <div style={{
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(15px)", // Efeito de vidro
        padding: "30px",
        borderRadius: "20px",
        width: "100%",
        maxWidth: "380px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        border: "1px solid rgba(255,255,255,0.5)"
      }}>
        <h3 style={{ marginTop: 0, color: "#2c3e50", fontWeight: "700" }}>
          {authTab === "login" ? "Bem-vinda ao Pragendar" : "Criar sua conta Premium"}
        </h3>
        
        <form onSubmit={handleAuth}>
          <div style={{ textAlign: "left", marginBottom: "15px" }}>
            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#7f8c8d", marginLeft: "5px" }}>E-mail</label>
            <input 
              placeholder="seu@email.com" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              style={{ ...inputStyle, backgroundColor: "rgba(255,255,255,0.8)", border: "1px solid #dcdde1" }} 
              required
            />
          </div>

          <div style={{ textAlign: "left", marginBottom: "20px" }}>
            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#7f8c8d", marginLeft: "5px" }}>Senha</label>
            <input 
              placeholder="••••••••" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={{ ...inputStyle, backgroundColor: "rgba(255,255,255,0.8)", border: "1px solid #dcdde1" }}
              required
            />
          </div>

          <button type="submit" style={{
            ...btnStyle, 
            background: `linear-gradient(135deg, #6b4f7a, #4a3457)`, // Tom Amethyst/Deep Navy
            boxShadow: "0 4px 15px rgba(74, 52, 87, 0.3)",
            fontSize: "16px",
            letterSpacing: "1px"
          }}>
            {authTab === "login" ? "Entrar" : "Finalizar Cadastro"}
          </button>
        </form>

        <p 
          onClick={() => setAuthTab(authTab === "login" ? "cadastro" : "login")} 
          style={{ cursor: "pointer", color: "#6b4f7a", marginTop: "20px", fontSize: "14px", fontWeight: "600" }}
        >
          {authTab === "login" ? "Ainda não tem conta? Toque aqui" : "Já possui conta? Entrar agora"}
        </p>
      </div>
    </div>
  );
}

  return (
  <div style={{ 
    backgroundColor: modernTheme.background, 
    backgroundImage: modernTheme.backgroundImage, // ADICIONADO
    backgroundAttachment: "fixed",               // ADICIONADO
    backgroundSize: "cover",
    backgroundPosition: "center",
    minHeight: "100vh", 
    paddingBottom: "100px", 
    fontFamily: "sans-serif" 
  }}>
     <header style={{ 
        display: "flex", 
        justifyContent: "space-between", // Empurra a logo pra esquerda e o Sair pra direita
        alignItems: "center", 
        padding: "15px 20px", 
        backgroundColor: modernTheme.card, 
        boxShadow: modernTheme.shadow,
        marginBottom: "15px",
        borderBottom: `3px solid ${primaryColor}`
      }}>
        {/* LADO ESQUERDO: LOGO + NOME */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${primaryColor}` }} />
          ) : (
            <div style={{ width: "45px", height: "45px", borderRadius: "50%", backgroundColor: primaryColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "20px" }}>✨</div>
          )}
          <div>
            <h1 style={{ color: modernTheme.text, margin: 0, fontSize: "16px", fontWeight: "800" }}>{nomeEmpresa || "Pragendar R$"}</h1>
            <small style={{ color: modernTheme.textMuted, fontSize: "10px", display: "block" }}>Painel Administrativo</small>
          </div>
        </div>

        {/* LADO DIREITO: BOTÃO SAIR */}
        <button 
          onClick={() => signOut(auth)} 
          style={{ 
            padding: "6px 12px", 
            backgroundColor: "transparent", 
            color: modernTheme.danger, 
            border: `1px solid ${modernTheme.danger}`,
            borderRadius: "6px",
            cursor: "pointer", 
            fontSize: "11px", 
            fontWeight: "bold"
          }}
        >
          Sair
        </button>
      </header>
      <nav style={{ 
        display: "flex", 
        gap: "8px", 
        overflowX: "auto", 
        padding: "15px",
        backgroundColor: "transparent",
        scrollBehavior: "smooth",
        WebkitOverflowScrolling: "touch"
      }}>
        {[
          { id: "agenda", icon: "📅", label: "Agenda" },
          { id: "financeiro", icon: "💰", label: "Caixa" },
          { id: "clientes", icon: "👥", label: "Clientes" },
          { id: "servicos", icon: "💇", label: "Serviços" },
          { id: "estoque", icon: "📦", label: "Estoque" },
          { id: "retornos", icon: "🔄", label: "Retornos" },
          { id: "perfil", icon: "⚙️", label: "Ajustes" }
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: "0 0 auto",
              minWidth: "85px",
              padding: "12px 12px", 
              borderRadius: modernTheme.radius, 
              border: "none",
              backgroundColor: tab === t.id ? primaryColor : modernTheme.card,
              color: tab === t.id ? "#fff" : modernTheme.textLight,
              boxShadow: tab === t.id ? `0 4px 15px ${primaryColor}40` : modernTheme.shadow,
              cursor: "pointer", 
              transition: "all 0.3s ease",
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              gap: "5px",
              fontWeight: tab === t.id ? "700" : "600",
              fontSize: "12px"
            }}
            onMouseOver={(e) => {
              if (tab !== t.id) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = modernTheme.shadowHeavy;
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = tab === t.id ? `0 4px 15px ${primaryColor}40` : modernTheme.shadow;
            }}
          >
            <span style={{ fontSize: "18px" }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ padding: "0 15px" }}>
        {/* === ABA AGENDA === */}
        {tab === "agenda" && (
          <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
            
            {/* 🔍 ÁREA DE BUSCA DE HISTÓRICO (PROJETO CRIS) */}
            <div style={{...cardStyle, boxShadow: modernTheme.shadow, marginBottom: "20px", borderLeft: `5px solid ${primaryColor}`}}>
              <h3 style={{color: modernTheme.text, fontSize: "14px", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px"}}>
                <span>🔍</span> Pesquisar Histórico de Cliente
              </h3>
              <input 
                placeholder="Digite nome ou número..." 
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                style={{...inputStyle, marginBottom: searchHistory.length >= 2 ? "15px" : "0"}}
              />

              {/* LISTAGEM DE RESULTADOS */}
              {searchHistory.length >= 2 && (
                <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "5px" }}>
                  {filteredHistory.length === 0 ? (
                    <p style={{fontSize: "12px", color: "#999", textAlign: "center", padding: "10px"}}>Nenhum registro encontrado para "{searchHistory}"</p>
                  ) : (
                    filteredHistory.map(app => {
                      const dataApp = new Date(app.dataHora);
                      const ehPassado = dataApp < new Date();
                      const serv = services.find(s => s.id === app.serviceId);
                      
                      return (
                        <div key={app.id} style={{
                          padding: "12px",
                          borderRadius: "10px",
                          // LÓGICA DE CORES: Cinza se passado, Cor do tema se futuro
                          backgroundColor: ehPassado ? "#f1f1f1" : modernTheme.primaryLight,
                          marginBottom: "10px",
                          border: `1px solid ${ehPassado ? "#ddd" : primaryColor + "40"}`,
                          opacity: ehPassado ? 0.6 : 1, // "Apagado" se for passado
                          transition: "all 0.2s ease"
                        }}>
                          <div style={{display: "flex", justifyContent: "space-between", marginBottom: "5px"}}>
                            <strong style={{fontSize: "13px", color: ehPassado ? "#666" : modernTheme.text}}>
                              {dataApp.toLocaleDateString("pt-BR")} às {String(dataApp.getHours()).padStart(2, "0")}:00h
                            </strong>
                            <span style={{
                              fontSize: "9px", 
                              fontWeight: "bold", 
                              padding: "2px 6px", 
                              borderRadius: "4px",
                              backgroundColor: ehPassado ? "#ccc" : primaryColor,
                              color: "#fff"
                            }}>
                              {ehPassado ? "PASSADO" : "AGENDADO"}
                            </span>
                          </div>
                          <p style={{margin: 0, fontSize: "13px", color: modernTheme.text}}>
                            <strong>Procedimento:</strong> {serv?.nome || "Não definido"}
                          </p>
                          {/* Detalhes do procedimento */}
                          <div style={{marginTop: "6px", fontSize: "11px", color: "#777", background: "rgba(255,255,255,0.4)", padding: "5px", borderRadius: "5px"}}>
                            {serv?.descricao ? `📝 ${serv.descricao}` : "ℹ️ Sem descrição cadastrada."}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <button onClick={() => setSearchHistory("")} style={{...btnMini, width: "100%", marginTop: "5px", backgroundColor: "#eee"}}>Fechar Pesquisa</button>
                </div>
              )}
            </div>

            {/* 📅 CALENDÁRIO DE SELEÇÃO DE DATA (RECUPERADO) */}
            <div style={{ ...cardStyle, boxShadow: modernTheme.shadow, marginBottom: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <button onClick={() => {
                  let m = viewMonth - 1; let y = viewYear;
                  if (m < 0) { m = 11; y--; }
                  setViewMonth(m); setViewYear(y);
                }} style={{...btnMini, backgroundColor: "#eee"}}>◀</button>
                <strong style={{ color: modernTheme.text }}>{nomeMeses[viewMonth]} {viewYear}</strong>
                <button onClick={() => {
                  let m = viewMonth + 1; let y = viewYear;
                  if (m > 11) { m = 0; y++; }
                  setViewMonth(m); setViewYear(y);
                }} style={{...btnMini, backgroundColor: "#eee"}}>▶</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", textAlign: "center" }}>
                {["D", "S", "T", "Q", "Q", "S", "S"].map(d => (
                  <small key={d} style={{ fontWeight: "bold", color: primaryColor, fontSize: "11px" }}>{d}</small>
                ))}
                {/* Espaços vazios para alinhar o início do mês */}
                {Array.from({ length: new Date(viewYear, viewMonth, 1).getDay() }).map((_, i) => <div key={i}></div>)}
                
                {/* Dias do mês */}
                {Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }).map((_, i) => {
                  const dia = i + 1;
                  const dObj = new Date(viewYear, viewMonth, dia);
                  const isSelected = selectedDate.toDateString() === dObj.toDateString();
                  const isToday = new Date().toDateString() === dObj.toDateString();
                  
                  return (
                    <div
                      key={dia}
                      onClick={() => setSelectedDate(dObj)}
                      style={{
                        padding: "8px 0",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        backgroundColor: isSelected ? primaryColor : "transparent",
                        color: isSelected ? "#fff" : (isToday ? primaryColor : modernTheme.text),
                        fontWeight: (isSelected || isToday) ? "bold" : "normal",
                        border: isToday && !isSelected ? `1px solid ${primaryColor}` : "none",
                        transition: "all 0.2s"
                      }}
                    >
                      {dia}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{...cardStyle, boxShadow: modernTheme.shadow, marginTop: "15px"}}>
              <h3 style={{borderBottom: `2px solid ${primaryColor}`, paddingBottom: "10px", color: modernTheme.text, margin: "0 0 15px 0"}}>📅 Dia {selectedDate.toLocaleDateString("pt-BR")}</h3>
              {(() => {
                const horaInicio = parseInt(horarioAbertura.split(":")[0]) || 8;
                const horaFim = parseInt(horarioFechamento.split(":")[0]) || 19;
                const totalHoras = horaFim - horaInicio + 1;
                const diaSemana = selectedDate.getDay();
                const configHoje = gradeHorarios[diaSemana];

                if (!configHoje?.aberta) {
                  return <div style={{textAlign: "center", padding: "40px 20px", color: modernTheme.textMuted, backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radius}}>😴 Estamos fechados hoje. Volte em outro dia!</div>;
                }

                return Array.from({ length: totalHoras }, (_, i) => i + horaInicio).map(hora => {
                  if (configHoje.tipo === "fixo" && !configHoje.horas?.includes(hora)) return null;

                  const agora = new Date();
                  const dataComparacao = new Date(selectedDate);
                  dataComparacao.setHours(hora, 0, 0, 0);
                  const ehPassado = dataComparacao < agora;

                  const app = getAppDoHorario(hora);
                  const isStart = app && new Date(app.dataHora).getHours() === hora;
                  

                  return (
                    <div key={hora} style={{ 
                      ...itemStyle, 
                      borderLeft: app?.status === "pago" ? `5px solid ${modernTheme.success}` : (app ? `5px solid ${modernTheme.warning}` : "1px solid #eee"), 
                      backgroundColor: app ? modernTheme.primaryLight : modernTheme.card,
                      borderRadius: modernTheme.radiusTiny,
                      marginBottom: "8px"
                    }}>
                      <div style={{ width: "60px", fontWeight: "bold", color: primaryColor, fontSize: "14px" }}>{String(hora).padStart(2, "0")}:00</div>
                      <div style={{ flex: 1 }}>
                        {app ? (
                          <div onClick={() => {setSelHora(hora); setEditAppId(app.id); setSelCliente(app.clientId); setSelServico(app.serviceId); setClientSearch(getNome(clients, app.clientId)); setShowModal(true);}} style={{cursor:"pointer", opacity: isStart ? 1 : 0.6}}>
                            <strong style={{color: modernTheme.text}}>{getNome(clients, app.clientId)}</strong> {isStart && `- ${getNome(services, app.serviceId)}`}
                          </div>
                        ) : (
                          ehPassado ? 
                          <span style={{color: modernTheme.textMuted, cursor:"not-allowed", fontSize: "12px"}}>Indisponível</span> :
                          <span onClick={() => {setSelHora(hora); setEditAppId(null); setSelCliente(""); setClientSearch(""); setShowModal(true);}} style={{color: modernTheme.success, cursor:"pointer", fontWeight: "bold", fontSize: "12px"}}>+ Disponível</span>
                        )}
                      </div>
                      {isStart && (
                        <div style={{ display: "flex", gap: "3px" }}>
                          <button onClick={() => sendWhatsAppReminder(app)} style={btnWhatsApp}>📱</button>
                          {app.status !== "pago" && <button onClick={() => handlePaymentClick(app)} style={btnPay}>💵</button>}
                          <button onClick={() => deleteWithConfirm("appointments", app.id, getNome(clients, app.clientId))} style={btnDel}>X</button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* === ABA FINANCEIRO === */}
        {/* === ABA FINANCEIRO === */}
{tab === "financeiro" && (
  <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
    {(() => {
      const hoje = new Date();
      const hojeFmt = hoje.toLocaleDateString("pt-BR");
      
      // Cálculo do início da semana (último domingo)
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      inicioSemana.setHours(0,0,0,0);

      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();

      // Filtros de Transações
      const tDia = transactions.filter(t => new Date(t.data).toLocaleDateString("pt-BR") === hojeFmt);
      const tSemana = transactions.filter(t => new Date(t.data) >= inicioSemana);
      const tMes = transactions.filter(t => {
        const d = new Date(t.data);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      });

      // Cálculos de ENTRADAS (Receita)
      // Cálculos de ENTRADAS (Receita)
      const recDia = tDia.filter(t => t.tipo === "receita").reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
      const recSemana = tSemana.filter(t => t.tipo === "receita").reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
      const recMes = tMes.filter(t => t.tipo === "receita").reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

      // Cálculos de GASTOS (Despesa)
      const despDia = tDia.filter(t => t.tipo === "despesa").reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
      const despSemana = tSemana.filter(t => t.tipo === "despesa").reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
      const despMes = tMes.filter(t => t.tipo === "despesa").reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

      // Métrica de Clientes (Mês)
      const appsMes = appointments.filter(a => {
        const d = new Date(a.dataHora);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      });
      const totalClientes = [...new Set(appsMes.map(a => a.clientId))].length;
      const retornosMarked = appointments.filter(a => a.status === "pago").length; // Exemplo de lógica

      return (   
                 <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  
                  {/* 📈 CARD DE ENTRADAS (REVISADO) */}
                  <div style={{...cardStyle, boxShadow: modernTheme.shadow, borderLeft: `5px solid ${modernTheme.success}`}}>
                    <h3 style={{color: modernTheme.success, marginBottom: "15px"}}>📈 Recebidos</h3>
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", textAlign: "center"}}>
                      <div><small style={{color: "#999", fontSize: "11px"}}>Hoje</small><br/><strong style={{fontSize: "13px"}}>R$ {recDia.toFixed(2)}</strong></div>
                      <div><small style={{color: "#999", fontSize: "11px"}}>Semana</small><br/><strong style={{fontSize: "13px"}}>R$ {recSemana.toFixed(2)}</strong></div>
                      <div style={{backgroundColor: modernTheme.primaryLight, borderRadius: "8px", padding: "5px"}}>
                        <small style={{color: primaryColor, fontSize: "11px", fontWeight: "bold"}}>Mês</small><br/>
                        <strong style={{color: primaryColor, fontSize: "13px"}}>R$ {recMes.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* 📉 CARD DE GASTOS (REVISADO) */}
                  <div style={{...cardStyle, boxShadow: modernTheme.shadow, borderLeft: `5px solid ${modernTheme.danger}`}}>
                    <h3 style={{color: modernTheme.danger, marginBottom: "15px"}}>📉 Gastos</h3>
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", textAlign: "center"}}>
                      <div><small style={{color: "#999", fontSize: "11px"}}>Hoje</small><br/><strong style={{fontSize: "13px"}}>R$ {despDia.toFixed(2)}</strong></div>
                      <div><small style={{color: "#999", fontSize: "11px"}}>Semana</small><br/><strong style={{fontSize: "13px"}}>R$ {despSemana.toFixed(2)}</strong></div>
                      <div style={{backgroundColor: "#fee2e2", borderRadius: "8px", padding: "5px"}}>
                        <small style={{color: "#b91c1c", fontSize: "11px", fontWeight: "bold"}}>Mês</small><br/>
                        <strong style={{color: "#b91c1c", fontSize: "13px"}}>R$ {despMes.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* 🎯 CARD DE METAS E PERFORMANCE (DINÂMICO) */}
                  <div style={{...cardStyle, boxShadow: modernTheme.shadow}}>
                    <h3 style={{color: primaryColor, marginBottom: "15px"}}>🎯 Performance do Mês</h3>
                    
                    <div style={{display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px"}}>
                      <span>Clientes: <strong>{totalClientes}</strong></span>
                      <span>Meta: <strong>{metaClientes || 60}</strong></span>
                    </div>

                    {/* Barra de Progresso Dinâmica */}
                    <div style={{width:"100%", height:"12px", backgroundColor: "#eee", borderRadius: "10px", overflow: "hidden", marginBottom: "20px"}}>
                      <div style={{
                        width: `${Math.min((totalClientes / (metaClientes || 60)) * 100, 100)}%`, 
                        height: "100%", 
                        backgroundColor: totalClientes >= (metaClientes || 60) ? "#d4af37" : modernTheme.success,
                        transition: "width 0.5s ease-in-out"
                      }}></div>
                    </div>

                    {/* Grid de Retornos e Agendamentos */}
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
                      <div style={{padding: "12px", backgroundColor: "#e8f5e9", borderRadius: "10px", textAlign: "center", border: "1px solid #c8e6c9"}}>
                        <small style={{color: "#2e7d32", fontSize: "11px", fontWeight: "bold"}}>COM RETORNO</small><br/>
                        <strong style={{fontSize: "18px", color: "#2e7d32"}}>{retornosMarked}</strong>
                      </div>
                      <div style={{padding: "12px", backgroundColor: "#fff3e0", borderRadius: "10px", textAlign: "center", border: "1px solid #ffe0b2"}}>
                        <small style={{color: "#ef6c00", fontSize: "11px", fontWeight: "bold"}}>A AGENDAR</small><br/>
                        <strong style={{fontSize: "18px", color: "#ef6c00"}}>{totalClientes - retornosMarked}</strong>
                      </div>
                    </div>
                  </div>

                {/* RESUMO HOJE/MÊS RÁPIDO */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ ...cardStyle, border: `1px solid ${modernTheme.success}`, textAlign: "center" }}>
                      <small>Hoje</small><br/><strong>R$ {calcTotal(transactions, "hoje").toFixed(2)}</strong>
                    </div>
                    <div style={{ ...cardStyle, border: `1px solid ${primaryColor}`, textAlign: "center" }}>
                      <small>Mês</small><br/><strong>R$ {calcTotal(transactions, "mes").toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* FORMULÁRIO DE LANÇAMENTO */}
                  <section style={{...cardStyle, boxShadow: modernTheme.shadow, marginTop: "10px"}}>
                    <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editId ? "✏️ Editar" : "➕ Novo"} Lançamento</h3>
                    <select value={tipoFin} onChange={e => setTipoFin(e.target.value)} style={inputStyle}>
                      <option value="receita">📈 Receita (Entrada)</option>
                      <option value="despesa">📉 Despesa (Saída)</option>
                    </select>
                    <input type="date" value={dataManualFin} onChange={e => setDataManualFin(e.target.value)} style={inputStyle} />
                    <input placeholder="Descrição" value={descFin} onChange={e => setDescFin(e.target.value)} style={inputStyle} />
                    <input placeholder="Valor R$" type="number" step="0.01" value={valorFin} onChange={e => setValorFin(e.target.value)} style={inputStyle} />
                    <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={inputStyle}>
                      <option value="pix">📲 Pix</option>
                      <option value="dinheiro">💵 Dinheiro</option>
                      <option value="cartao">💳 Cartão</option>
                    </select>
                    <button onClick={handleSaveTransaction} style={{...btnStyle, background: tipoFin==="receita" ? modernTheme.success : modernTheme.danger}}>
                      {editId ? "💾 Salvar Alteração" : "✅ Gravar no Caixa"}
                    </button>
                  </section>

                  {/* EXTRATO DETALHADO */}
                  <h3 style={{marginTop: "20px", fontSize: "16px"}}>📋 Extrato Recente</h3>
                  {tMes.length === 0 ? (
                    <p style={{textAlign: "center", color: "#999", fontSize: "13px"}}>Nenhuma transação este mês.</p>
                  ) : (
                    // Blindagem: Filtra itens corrompidos e garante que a data exista para não dar erro
                    tMes.filter(t => t && t.data && t.valor !== undefined)
                        .sort((a,b) => (b.data || "").localeCompare(a.data || ""))
                        .slice(0, 10).map(t => (
                      <div key={t.id} style={{...itemStyle, marginBottom: "8px", backgroundColor: "#fff", borderRadius: "8px"}}>
                        <span style={{flex:1}}>
                          <small style={{color: "#999"}}>{t.data ? new Date(t.data).toLocaleDateString() : "---"}</small><br/>
                          <strong>{t.descricao || "Sem descrição"}</strong>
                        </span>
                        <strong style={{color: t.tipo === "receita" ? modernTheme.success : modernTheme.danger, marginLeft: "10px"}}>
                          {t.tipo === "receita" ? "+" : "-"} R$ {(Number(t.valor) || 0).toFixed(2)}
                        </strong>
                      </div>
                    ))
                  )}
                </div>
              ); // 👈 Fim do Return Visual
            })()} {/* 👈 Fim da IIFE */}
          </div>
        )}

    {/* === ABA CLIENTES === */}
    {tab === "clientes" && (
      <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
          <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editId ? "✏️ Editar" : "👤 Novo"} Cliente</h3>
          <input placeholder="👤 Nome Completo" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} style={inputStyle} />
          <input placeholder="📱 Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={inputStyle} />
          <button onClick={async () => {
            if (!nomeCliente.trim()) return alert("Digite o nome do cliente");
            const d = { nome: nomeCliente, telefone, tenantId: user.uid };
            try {
              if(editId) await updateDoc(doc(db, "clients", editId), d);
              else await addDoc(collection(db, "clients"), d);
              setEditId(null); setNomeCliente(""); setTelefone(""); loadData(user.uid);
            } catch (error) {
              alert("❌ Erro: " + error.message);
            }
          }} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>✅ Salvar Cliente</button>
        </section>

            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "10px"}}>📥 Importar Clientes via CSV</h3>
              <p style={{fontSize:"12px", color: modernTheme.textLight, marginBottom:"12px", fontWeight: "600"}}>
                ✅ Formato: Nome,Telefone - Sem limite de contatos!
              </p>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleCSVImport}
                disabled={importingCSV}
                style={inputStyle}
              />
              {importingCSV && <p style={{fontSize:"12px", color: modernTheme.info, fontWeight: "600"}}>⏳ Importando...</p>}
            </section>

            <input placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "15px" }}>
              {alfabeto.map(l => <button key={l} onClick={() => setSelectedLetter(l)} style={btnLetter(selectedLetter === l)}>{l}</button>)}
              <button onClick={() => setSelectedLetter("")} style={btnLetter(selectedLetter === "")}>Tudo</button>
            </div>
            <p style={{fontSize: "12px", color: modernTheme.textMuted, fontWeight: "600"}}>
              👥 Total: {clients.filter(c => (c.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || (c.nome || "").toUpperCase().startsWith(selectedLetter))).length} clientes
            </p>

            {clients.filter(c => (c.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) && (selectedLetter==="" || (c.nome || "").toUpperCase().startsWith(selectedLetter))).map(c => {
              const fidelity = getClientFidelity(c.id);
              return (
                <div key={c.id} style={{...itemStyle, borderLeft: fidelity.achieved ? `4px solid ${modernTheme.warning}` : "1px solid #eee", borderRadius: modernTheme.radiusTiny, marginBottom: "8px", boxShadow: modernTheme.shadow}}>
                  <span style={{flex:1, cursor:"pointer"}} onClick={() => {setSelectedClientForHistory(c); setShowClientHistoryModal(true);}}>
                    <strong style={{color: modernTheme.text}}>{c.nome || "Sem Nome"}</strong>
                    <br/><small style={{color: modernTheme.textMuted}}>{c.telefone || "Sem telefone"}</small>
                    {fidelity.achieved && <br/>}
                    {fidelity.achieved && <small style={{color: modernTheme.warning, fontWeight:"bold"}}>🎁 Prêmio atingido!</small>}
                  </span>
                  <button onClick={() => {setEditId(c.id); setNomeCliente(c.nome || ""); setTelefone(c.telefone || "")}} style={btnEdit}>✏️</button>
                  <button onClick={() => deleteWithConfirm("clients", c.id, c.nome || "Cliente", c.telefone)} style={btnDel}>🗑️</button>
                </div>
              );
            })}
          </div>
        )}

        {/* === ABA SERVIÇOS === */}
        {tab === "servicos" && (
          <div>
            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editId ? "✏️ Editar Serviço" : "💇 Novo Serviço"}</h3>
              
              <label style={labelStyle}>Nome do Serviço</label>
              <input placeholder="Ex: Alongamento..." value={nomeServico} onChange={e => setNomeServico(e.target.value)} style={inputStyle} />
              
              <label style={labelStyle}>Preço R$</label>
              <input placeholder="0.00" type="number" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} style={inputStyle} />

              <label style={labelStyle}>Descrição</label>
              <textarea 
                placeholder="Detalhes..." 
                value={descServico} 
                onChange={e => setDescServico(e.target.value)} 
                style={{...inputStyle, height: "80px", resize: "none"}} 
              />

              <label style={labelStyle}>⏱️ Tempo de Duração</label>
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <div style={{flex: 1}}>
                  <small style={{fontWeight: "600", color: modernTheme.textLight}}>Horas</small>
                  <input type="number" value={tempoHoras} onChange={e => setTempoHoras(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={{flex: 1}}>
                  <small style={{fontWeight: "600", color: modernTheme.textLight}}>Minutos</small>
                  <input type="number" value={tempoMinutos} onChange={e => setTempoMinutos(Number(e.target.value))} style={inputStyle} />
                </div>
              </div>

              <button onClick={async () => {
                const duracaoTotal = (tempoHoras * 60) + tempoMinutos;
                if (!nomeServico.trim() || !preco || duracaoTotal <= 0) {
                  return alert("Preencha o nome, preço e a duração do serviço!");
                }

                const d = { 
                  nome: nomeServico, 
                  preco: Number(preco), 
                  duracao: duracaoTotal, 
                  descricao: descServico,
                  tenantId: user.uid 
                };

                try {
                  if(editId) await updateDoc(doc(db, "services", editId), d);
                  else await addDoc(collection(db, "services"), d);
                  
                  setEditId(null); setNomeServico(""); setPreco(""); 
                  setDescServico(""); setTempoHoras(0); setTempoMinutos(30);
                  loadData(user.uid);
                  alert("✅ Serviço salvo!");
                } catch (error) {
                  alert("❌ Erro: " + error.message);
                }
              }} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>
                {editId ? "💾 Salvar Alterações" : "➕ Cadastrar Serviço"}
              </button>
              {editId && <button onClick={() => {setEditId(null); setNomeServico(""); setPreco(""); setDescServico(""); setTempoHoras(0); setTempoMinutos(30);}} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card, marginTop:"8px"}}>❌ Cancelar</button>}
            </section>

            <h3 style={{color: modernTheme.text, marginTop: "20px", marginBottom: "10px"}}>💇 Serviços Cadastrados ({services.length})</h3>
            {services.length === 0 ? (
              <div style={{...cardStyle, textAlign: "center", color: modernTheme.textMuted, boxShadow: modernTheme.shadow}}>Nenhum serviço cadastrado</div>
            ) : (
              services.map(s => (
                <div key={s.id} style={{...itemStyle, borderRadius: modernTheme.radiusTiny, marginBottom: "8px", boxShadow: modernTheme.shadow}}>
                  <span style={{flex:1}}>
                    <strong style={{color: modernTheme.text}}>{s.nome}</strong><br/>
                    <small style={{color: modernTheme.textLight, fontWeight: "600"}}>R${s.preco.toFixed(2)} - {s.duracao >= 60 ? `${Math.floor(s.duracao/60)}h ${s.duracao%60}min` : `${s.duracao}min`}</small>
                    {s.descricao && <><br/><small style={{color: modernTheme.textMuted, fontStyle: "italic"}}>{s.descricao}</small></>}
                  </span>
                  <button onClick={() => {
                    setEditId(s.id); 
                    setNomeServico(s.nome); 
                    setPreco(s.preco);
                    setDescServico(s.descricao || "");
                    setTempoHoras(Math.floor(s.duracao / 60));
                    setTempoMinutos(s.duracao % 60);
                  }} style={btnEdit}>✏️</button>
                  <button onClick={() => deleteWithConfirm("services", s.id, s.nome)} style={btnDel}>🗑️</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* === ABA ESTOQUE === */}
        {tab === "estoque" && (
          <div>
            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>{editProductId ? "✏️ Editar Produto" : "📦 Novo Produto"}</h3>
              <input placeholder="📦 Nome do Produto" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} style={inputStyle} />
              <input placeholder="📊 Quantidade" type="number" value={qtdProduto} onChange={e => setQtdProduto(e.target.value)} style={inputStyle} />
              <input placeholder="⚠️ Alerta Crítico (mín)" type="number" value={alerta} onChange={e => setAlerta(e.target.value)} style={inputStyle} />
              <button onClick={handleSaveProduct} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>{editProductId ? "💾 Atualizar" : "➕ Adicionar"}</button>
              {editProductId && <button onClick={() => {setEditProductId(null); setNomeProduto(""); setQtdProduto(""); setAlerta("");}} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card, marginTop:"8px"}}>❌ Cancelar</button>}
            </section>

            <h3 style={{color: modernTheme.text, marginTop: "20px", marginBottom: "10px"}}>📦 Inventário ({inventory.length})</h3>
            {inventory.length === 0 ? (
              <div style={{...cardStyle, textAlign: "center", color: modernTheme.textMuted, boxShadow: modernTheme.shadow}}>Nenhum produto cadastrado</div>
            ) : (
              inventory.map(prod => {
                const critico = Number(prod.quantidade) <= Number(prod.alertaCritico);
                return (
                  <div key={prod.id} style={{...itemStyle, borderLeft: critico ? `4px solid ${modernTheme.danger}` : `4px solid ${modernTheme.success}`, backgroundColor: critico ? modernTheme.primaryLight : modernTheme.card, borderRadius: modernTheme.radiusTiny, marginBottom: "8px", boxShadow: modernTheme.shadow}}>
                    <span style={{flex:1}}>
                      <strong style={{color: modernTheme.text}}>{prod.nome}</strong><br/>
                      <small style={{color: modernTheme.textLight, fontWeight: "600"}}>{prod.quantidade} un. {critico && <span style={{color: modernTheme.danger, fontWeight:"bold"}}>⚠️ CRÍTICO</span>}</small>
                    </span>
                    <button onClick={() => {setEditProductId(prod.id); setNomeProduto(prod.nome); setQtdProduto(prod.quantidade); setAlerta(prod.alertaCritico);}} style={btnEdit}>✏️</button>
                    <button onClick={() => deleteWithConfirm("inventory", prod.id, prod.nome)} style={btnDel}>🗑️</button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* === ABA RETORNOS === */}
        {tab === "retornos" && (
          <div>
            <div style={{...cardStyle, boxShadow: modernTheme.shadow, borderLeft: `4px solid ${primaryColor}`}}>
              <h3 style={{borderBottom: `2px solid ${primaryColor}`, paddingBottom: "10px", color: modernTheme.text, margin: "0 0 10px 0"}}>🔄 Sugestão de Retorno (30 dias)</h3>
              <p style={{fontSize: "12px", color: modernTheme.textLight, marginBottom: "0", fontWeight: "500"}}>Clientes que completam 30 dias desde o último atendimento.</p>
            </div>

            {clients.length === 0 ? (
              <div style={{...cardStyle, textAlign: "center", color: modernTheme.textMuted, boxShadow: modernTheme.shadow, marginTop: "15px"}}>Nenhuma cliente cadastrada</div>
            ) : (
              clients.map(cli => {
                const history = getClientHistory(cli.id);
                if (history.count === 0) return null;
                const ultimaData = new Date(history.apps[0].dataHora);
                const dataRetorno = new Date(ultimaData);
                dataRetorno.setDate(dataRetorno.getDate() + 30);
                
                return (
                  <div key={cli.id} style={{...itemStyle, borderLeft: `4px solid ${primaryColor}`, borderRadius: modernTheme.radiusTiny, marginTop: "10px", boxShadow: modernTheme.shadow}}>
                    <span style={{flex: 1}}>
                      <strong style={{color: modernTheme.text}}>{cli.nome}</strong><br/>
                      <small style={{color: modernTheme.textLight, fontWeight: "600"}}>Último: {ultimaData.toLocaleDateString("pt-BR")}</small><br/>
                      <small style={{color: primaryColor, fontWeight: "bold"}}>📅 Retorno: {dataRetorno.toLocaleDateString("pt-BR")}</small>
                    </span>
                    <button onClick={() => {
                      setSelectedDate(dataRetorno);
                      setTab("agenda");
                    }} style={{...btnStyle, width: "auto", padding: "6px 12px", fontSize: "12px", background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`}}>Agendar</button>
                  </div>
                );
              }).filter(item => item !== null)
            )}
          </div>
        )}

        {/* === ABA PERFIL === */}
        {tab === "perfil" && (
          <div>
            <section style={{...cardStyle, boxShadow: modernTheme.shadow}}>
              <h3 style={{color: primaryColor, marginBottom: "15px"}}>⚙️ Perfil da Profissional</h3>
              {!editingProfile ? (
                <div>
                  <div style={{ marginBottom: "20px", textAlign: "center", padding: "20px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radius }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ width: "100px", height: "100px", borderRadius: "50%", objectFit: "cover", marginBottom: "15px", border: `3px solid ${primaryColor}` }} />
                    ) : (
                      <div style={{ width: "100px", height: "100px", borderRadius: "50%", backgroundColor: primaryColor, margin: "0 auto 15px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "40px" }}>📷</div>
                    )}
                    <p style={{ margin: "8px 0", fontSize: "16px", fontWeight: "bold", color: modernTheme.text }}>{nomeEmpresa || "Seu Salão"}</p>
                    <p style={{ margin: "5px 0", fontSize: "13px", color: modernTheme.textLight }}>{telefoneProfissional || "Telefone não definido"}</p>
                    <p style={{ margin: "5px 0", fontSize: "12px", color: modernTheme.textMuted }}>
                      🕐 {horarioAbertura} às {horarioFechamento}
                    </p>
                    <p style={{ margin: "5px 0", fontSize: "12px", color: modernTheme.textMuted }}>
                      🎁 Fidelidade: A cada {fidelidadeLimit} atendimentos
                    </p>
                    {/* 🆕 EXIBIR LINK DA PÁGINA DE AGENDAMENTO */}
                    <div style={{ marginTop: "15px", padding: "10px", backgroundColor: primaryColor + "20", borderRadius: "8px" }}>
                      <strong style={{ color: primaryColor, display: "block", marginBottom: "5px" }}>🔗 Sua Página de Agendamento:</strong>
                      <small style={{ color: modernTheme.text, wordBreak: "break-all" }}>
                        {window.location.origin}?p={user?.uid || "seu-id"}
                      </small>
                      <br />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}?p=${user?.uid || "seu-id"}`);
                          alert("✅ Link copiado para a área de transferência!");
                        }}
                        style={{
                          marginTop: "8px",
                          padding: "6px 12px",
                          backgroundColor: primaryColor,
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold"
                        }}
                      >
                        📋 Copiar Link
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setEditingProfile(true)} style={{...btnStyle, background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`, marginBottom: "8px"}}>✏️ Editar Perfil</button>
                  <button onClick={printReport} style={{...btnStyle, background: `linear-gradient(135deg, ${modernTheme.warning}, ${modernTheme.warning}dd)`}}>🖨️ Imprimir Relatório</button>
                </div>
              ) : (
                <div>
                  <input 
                    placeholder="Nome da Empresa/Salão" 
                    value={nomeEmpresa} 
                    onChange={e => setNomeEmpresa(e.target.value)} 
                    style={inputStyle} 
                  />
                  
                  <label style={labelStyle}>🎨 Cor Principal do Sistema</label>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "15px", alignItems: "center" }}>
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ width: "60px", height: "50px", border: "none", cursor: "pointer", borderRadius: modernTheme.radiusTiny }}
                    />
                    <div style={{ flex: 1, fontSize: "12px", color: modernTheme.textLight, fontWeight: "500" }}>
                      Escolha a cor que melhor representa seu salão. Isso mudará todos os botões, títulos e destaques do sistema!
                    </div>
                  </div>
                  {/* Adicione isso dentro da aba de Perfil, na parte de edição */}
<label style={labelStyle}>🎭 Estilo Visual do App</label>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
  {Object.values(TEMAS).map(t => (
    <div 
      key={t.id}
      onClick={() => {
        // Atualiza localmente para ver o brilho na hora
        setProfile({...profile, themeId: t.id});
        setPrimaryColor(t.primary); 
      }}
      style={{
        padding: "10px",
        borderRadius: "10px",
        border: `2px solid ${profile?.themeId === t.id ? t.primary : "#eee"}`,
        backgroundColor: t.background,
        cursor: "pointer",
        textAlign: "center"
      }}
    >
      <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: t.primary, margin: "0 auto 5px" }}></div>
      <small style={{ color: t.text, fontSize: "10px", fontWeight: "bold" }}>{t.nome}</small>
    </div>
  ))}
</div>

                  <label style={labelStyle}>📷 Logo do Salão</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                    disabled={uploadingLogo}
                    style={inputStyle} 
                  />
                  {uploadingLogo && <p style={{fontSize:"12px", color: modernTheme.info, fontWeight: "600"}}>⏳ Enviando...</p>}
                  {logoUrl && (
                    <div style={{ textAlign: "center", marginBottom: "15px", padding: "10px", backgroundColor: modernTheme.primaryLight, borderRadius: modernTheme.radiusTiny }}>
                      <img src={logoUrl} alt="Preview" style={{ width: "70px", height: "70px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${primaryColor}` }} />
                      <p style={{ fontSize: "11px", color: modernTheme.success, margin: "8px 0 0 0", fontWeight: "600" }}>✅ Logo atualizado</p>
                    </div>
                  )}

                  <input 
                    placeholder="📞 Telefone de Contato" 
                    value={telefoneProfissional} 
                    onChange={e => setTelefoneProfissional(e.target.value)} 
                    style={inputStyle} 
                  />
                  <label style={labelStyle}>🕐 Horário de Abertura</label>
                  <input 
                    type="time"
                    value={horarioAbertura} 
                    onChange={e => setHorarioAbertura(e.target.value)} 
                    style={inputStyle} 
                  />

                  <label style={labelStyle}>🕐 Horário de Fechamento</label>
                  <input 
                    type="time"
                    value={horarioFechamento} 
                    onChange={e => setHorarioFechamento(e.target.value)} 
                    style={inputStyle} 
                  />

                  <label style={labelStyle}>🎁 Limite de Fidelidade (atendimentos)</label>
                  <input 
                    type="number"
                    value={fidelidadeLimit}
                    onChange={e => setFidelidadeLimit(Number(e.target.value))}
                    style={inputStyle}
                  />

                  {/* 🆕 CAMPOS SaaS PARA PAGAMENTO */}
                  <label style={labelStyle}>📲 Chave PIX (para clientes pagarem sinal)</label>
                  <input 
                    placeholder="Ex: seu-email@gmail.com ou CPF ou número de telefone" 
                    value={chavePix} 
                    onChange={e => setChavePix(e.target.value)} 
                    style={inputStyle} 
                  />

                  <label style={labelStyle}>💳 Link de Pagamento por Cartão (Stripe, Asaas, etc.)</label>
                  <input 
                    placeholder="Ex: https://pay.stripe.com/..." 
                    value={linkCartao} 
                    onChange={e => setLinkCartao(e.target.value)} 
                    style={inputStyle} 
                  />

                  <label style={labelStyle}>% Sinal do Agendamento</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={porcentagemSinal} 
                    onChange={e => setPorcentagemSinal(Number(e.target.value))} 
                    style={inputStyle} 
                  />

                  <label style={labelStyle}>⚠️ Termos de Uso (aparecem na página de agendamento)</label>
                  <textarea 
                    value={termosUso} 
                    onChange={e => setTermosUso(e.target.value)} 
                    style={{...inputStyle, height: "80px", resize: "none"}} 
                    placeholder="Ex: O não comparecimento implica na perda do sinal..."
                  />

                  {/* Edição de Horários por dia */}
<label style={labelStyle}>⚙️ Configurar Horários Disponíveis</label>
<div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((nome, index) => (
    <div key={index} style={{ 
      padding: "15px", 
      border: `1px solid ${primaryColor}20`, 
      borderRadius: modernTheme.radius,
      backgroundColor: gradeHorarios[index].aberta ? "#fff" : "#f1f1f1" 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <strong style={{ color: modernTheme.text }}>{nome}</strong>
        <button 
          onClick={() => setGradeHorarios({...gradeHorarios, [index]: {...gradeHorarios[index], aberta: !gradeHorarios[index].aberta}})}
          style={{ 
            padding: "5px 10px", 
            fontSize: "11px", 
            backgroundColor: gradeHorarios[index].aberta ? modernTheme.success : "#ccc",
            color: "white", border: "none", borderRadius: "4px", cursor: "pointer" 
          }}
        >
          {gradeHorarios[index].aberta ? "ABERTO" : "FECHADO"}
        </button>
      </div>

      {gradeHorarios[index].aberta && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(h => {
            const isSelected = gradeHorarios[index].horas?.includes(h);
            return (
              <button
                key={h}
                onClick={() => {
                  let novasHoras = gradeHorarios[index].horas || [];
                  if (isSelected) {
                    novasHoras = novasHoras.filter(item => item !== h);
                  } else {
                    novasHoras = [...novasHoras, h].sort((a, b) => a - b);
                  }
                  setGradeHorarios({...gradeHorarios, [index]: {...gradeHorarios[index], horas: novasHoras}});
                }}
                style={{
                  padding: "6px",
                  fontSize: "10px",
                  borderRadius: "4px",
                  border: `1px solid ${primaryColor}`,
                  backgroundColor: isSelected ? primaryColor : "transparent",
                  color: isSelected ? "white" : primaryColor,
                  cursor: "pointer",
                  minWidth: "40px"
                }}
              >
                {h}:00
              </button>
            );
          })}
        </div>
      )}
    </div>
  ))}
</div>

                  <button onClick={handleSaveProfile} style={{...btnStyle, background: `linear-gradient(135deg, ${modernTheme.success}, ${modernTheme.success}dd)`, marginBottom: "8px"}}>💾 Salvar Alterações</button>
                  <button onClick={() => setEditingProfile(false)} style={{...btnStyle, backgroundColor: modernTheme.textMuted, color: modernTheme.card}}>❌ Cancelar</button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ========== 🤖 BOTÃO FLUTUANTE DA IA ========== */}
      <button 
        onClick={() => setShowAI(!showAI)}
        style={{
          position: "fixed", 
          bottom: "30px", 
          right: "20px",
          width: "70px", 
          height: "70px", 
          borderRadius: "50%",
          backgroundColor: primaryColor, 
          color: "white",
          border: "none", 
          boxShadow: modernTheme.shadowHeavy,
          fontSize: "28px", 
          cursor: "pointer", 
          zIndex: 2000,
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          transition: "all 0.3s ease",
          fontWeight: "bold"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Gerente Virtual IA"
      >
        {showAI ? "✖️" : "🤖"}
      </button>

      {/* ========== 🤖 BARRA LATERAL DA IA COM BOTÕES DE AÇÃO RÁPIDA ========== */}
      {showAI && (
        <div style={{
          position: "fixed", 
          top: 0, 
          right: 0, 
          width: "340px", 
          height: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.95)", 
          backdropFilter: "blur(15px)",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", 
          zIndex: 1999,
          padding: "0",
          display: "flex", 
          flexDirection: "column",
          animation: "slideInRight 0.3s ease-out",
          overflowY: "auto"
        }}>
          {/* HEADER DO CHAT */}
          <div style={{ 
            padding: "20px 15px", 
            backgroundColor: primaryColor, 
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: `3px solid ${primaryColor}60`,
            position: "sticky",
            top: 0,
            zIndex: 10
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
              🤖 Gerente Virtual
            </h3>
            <button 
              onClick={() => setShowAI(false)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => e.target.style.transform = "scale(1.2)"}
              onMouseOut={(e) => e.target.style.transform = "scale(1)"}
            >
              ✕
            </button>
          </div>

          {/* HISTÓRICO DE CHAT */}
          <div style={{ 
            flex: 1, 
            overflowY: "auto", 
            padding: "15px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            {/* PRIMEIRA MENSAGEM */}
            <div style={{
              backgroundColor: modernTheme.primaryLight,
              padding: "12px",
              borderRadius: modernTheme.radius,
              fontSize: "13px",
              color: modernTheme.text,
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              borderLeft: `4px solid ${primaryColor}`
            }}>
              {aiResponse}
            </div>

            {/* HISTÓRICO DE CONVERSAS COM AÇÕES RÁPIDAS */}
            {aiChatHistory.map((chat, index) => (
              <div key={index}>
                {/* Pergunta do Usuário */}
                <div style={{
                  backgroundColor: primaryColor,
                  color: "white",
                  padding: "10px",
                  borderRadius: modernTheme.radius,
                  fontSize: "12px",
                  textAlign: "right",
                  marginLeft: "30px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }}>
                  {chat.pergunta}
                </div>

                {/* Resposta da IA */}
                <div style={{
                  backgroundColor: modernTheme.primaryLight,
                  padding: "10px",
                  borderRadius: modernTheme.radius,
                  fontSize: "12px",
                  color: modernTheme.text,
                  textAlign: "left",
                  marginRight: "30px",
                  marginTop: "6px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  borderLeft: `3px solid ${primaryColor}`
                }}>
                  {chat.resposta}
                </div>

                {/* BOTÕES DE AÇÃO RÁPIDA */}
                {chat.acoes && chat.acoes.tipo === "sumidas" && (
                  <div style={{
                    marginRight: "30px",
                    marginTop: "8px",
                    marginBottom: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}>
                    {chat.acoes.clientes.map((cliente, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          sendCobrancaWhatsApp(cliente);
                          alert(`✅ WhatsApp aberto para ${cliente.nome}!`);
                        }}
                        style={{
                          padding: "8px 10px",
                          backgroundColor: "#25D366",
                          color: "white",
                          border: "none",
                          borderRadius: modernTheme.radiusTiny,
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "bold",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          justifyContent: "center"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.opacity = "0.9";
                          e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.opacity = "1";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        📲 Cobrar {cliente.nome}
                      </button>
                    ))}
                  </div>
                )}

                {/* AÇÃO RÁPIDA: Cliente Específico */}
                {chat.acoes && chat.acoes.tipo === "cliente" && chat.acoes.cliente && (
                  <div style={{
                    marginRight: "30px",
                    marginTop: "8px",
                    marginBottom: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}>
                    <button
                      onClick={() => {
                        sendCobrancaWhatsApp(chat.acoes.cliente);
                        alert(`✅ WhatsApp aberto para ${chat.acoes.cliente.nome}!`);
                      }}
                      style={{
                        padding: "8px 10px",
                        backgroundColor: "#25D366",
                        color: "white",
                        border: "none",
                        borderRadius: modernTheme.radiusTiny,
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "bold",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.opacity = "0.9";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      📲 Enviar WhatsApp
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ========== INPUT DE PERGUNTA (CORRIGIDO) ========== */}
      <div style={{ 
        padding: "15px",
        borderTop: `1px solid ${primaryColor}20`,
        backgroundColor: "rgba(255,255,255,0.8)",
        position: "sticky",
        bottom: 0,
        zIndex: 10
      }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
          
          {/* 1. BOTÃO DA CÂMERA */}
          <button 
            type="button"
            onClick={() => document.getElementById('ai-photo-upload').click()}
            style={{
              padding: "10px",
              backgroundColor: modernTheme.primaryLight,
              border: `1px solid ${primaryColor}40`,
              borderRadius: modernTheme.radiusTiny,
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            title="Escanear Agenda Física"
          >
            📷
          </button>

          {/* 2. CAMPO DE TEXTO (INPUT) */}
          <input 
            placeholder="Pergunte ou envie foto..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyPress={async (e) => {
              if (e.key === 'Enter' && aiQuery.trim()) {
                const pergunta = aiQuery;
                setAiQuery("");
                setAiResponse("🤖 Deixa eu ver aqui...");
                await askAI(pergunta);
              }
            }}
            style={{ 
              ...inputStyle, 
              marginBottom: 0, 
              flex: 1,
              fontSize: "14px"
            }} 
          />

          {/* 3. BOTÃO DE ENVIAR (📤) */}
          <button 
            type="button"
            onClick={async () => {
              if (aiQuery.trim()) {
                const pergunta = aiQuery;
                setAiQuery("");
                setAiResponse("🤖 Analisando...");
                await askAI(pergunta);
              }
            }}
            style={{
              padding: "10px 14px",
              backgroundColor: primaryColor,
              color: "white",
              border: "none",
              borderRadius: modernTheme.radiusTiny,
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            📤
          </button>
        </div>

        {/* 4. INPUT DE ARQUIVO ESCONDIDO (PARA A CÂMERA) */}
        <input 
          type="file" 
          id="ai-photo-upload" 
          accept="image/*" 
          style={{ display: "none" }} 
          onChange={async (e) => {
            const file = e.target.files[0];
            if (file) {
              setAiResponse("⏳ Analisando sua agenda física... Só um instante.");
              await processAgendaImage(file);
            }
          }}
        />

  {/* SUGESTÕES RÁPIDAS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {[
                { icon: "📅", texto: "Hoje", query: "Meus horários hoje" },
                { icon: "💰", texto: "Caixa", query: "Meu financeiro" },
                { icon: "👥", texto: "Clientes", query: "Quantos clientes tenho" },
                { icon: "🔄", texto: "Ausentes", query: "Clientes sumidas" }
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={() => {
                    askAI(btn.query);
                    setAiQuery("");
                  }}
                  style={{
                    padding: "8px",
                    backgroundColor: modernTheme.primaryLight,
                    border: `1px solid ${primaryColor}40`,
                    borderRadius: modernTheme.radiusTiny,
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: modernTheme.text,
                    transition: "all 0.2s ease"
                  }}
                >
                  {btn.icon} {btn.texto}
                </button>
              ))}
            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          ` }} />
        </div>
      )}

      {/* ========== MODAL DE AGENDAMENTO (VERSÃO COMPLETA) ========== */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={{...modalContent, borderTop: `4px solid ${primaryColor}`, maxWidth: "400px"}}>
            <h3 style={{color: primaryColor, marginBottom: "15px"}}>
              {editAppId ? "✏️ Editar Horário" : "📅 Novo Agendamento"}
            </h3>
            
            <p style={{fontSize: "12px", color: "#666", marginBottom: "10px"}}>
              Horário selecionado: <strong>{String(selHora).padStart(2, "0")}:00h</strong>
            </p>

            <label style={labelStyle}>👤 Buscar Cliente</label>
            <input 
              placeholder="Digite o nome..." 
              value={clientSearch} 
              onChange={e => {setClientSearch(e.target.value); setSelCliente("");}} 
              style={inputStyle} 
            />
            
            {clientSearch && !selCliente && (
              <div style={dropdownStyle}>
                {clients.filter(c => c.nome.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 5).map(c => (
                  <div key={c.id} onClick={() => {setSelCliente(c.id); setClientSearch(c.nome)}} style={dropdownItem}>
                    {c.nome} - <small>{c.telefone}</small>
                  </div>
                ))}
              </div>
            )}

            <label style={labelStyle}>💇 Serviço</label>
            <select value={selServico} onChange={e => setSelServico(e.target.value)} style={inputStyle}>
              <option value="">Selecione o Serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.nome} (R$ {s.preco})</option>)}
            </select>

            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button 
                onClick={handleSaveAppointment} 
                style={{...btnStyle, backgroundColor: modernTheme.success}}
              >
                {editAppId ? "💾 Salvar Alterações" : "✅ Confirmar Agendamento"}
              </button>

              <button 
                onClick={() => setShowModal(false)} 
                style={{...btnStyle, backgroundColor: "#ccc"}}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 O MODAL DE PAGAMENTO ENTRA AQUI (DENTRO DA DIV PRINCIPAL) */}
      {showPaymentModal && selectedAppForPayment && (
        <div style={modalOverlay}>
          <div style={{...modalContent, borderTop: `4px solid ${modernTheme.success}`}}>
            <h3 style={{color: modernTheme.success}}>💰 Confirmar Pagamento</h3>
            <p style={{fontSize: "14px", color: modernTheme.text}}>
              Deseja confirmar o recebimento do pagamento de <strong>{getNome(clients, selectedAppForPayment.clientId)}</strong>?
            </p>
            <div style={{padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "8px", marginBottom: "15px"}}>
              <small>Serviço: {getNome(services, selectedAppForPayment.serviceId)}</small><br/>
              <strong>Valor: R$ {services.find(s => s.id === selectedAppForPayment.serviceId)?.preco.toFixed(2)}</strong>
            </div>
            
            <label style={labelStyle}>Forma de Recebimento:</label>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={inputStyle}>
              <option value="pix">📲 Pix</option>
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="cartao">💳 Cartão</option>
            </select>

            <button onClick={confirmPayment} style={{...btnStyle, backgroundColor: modernTheme.success}}>✅ Confirmar e Salvar no Caixa</button>
            <button onClick={() => setShowPaymentModal(false)} style={{...btnStyle, backgroundColor: "#ccc", marginTop: "10px"}}>Cancelar</button>
          </div>
        </div>
      )}

    </div> // ⬅️ Penúltima chave (fecha a div principal)
  ); // ⬅️ Fecha o return
} // ⬅️ ÚLTIMA CHAVE (fecha a função App)

// ========== ESTILOS E AUXILIARES (FORA DO APP) ==========
// Seus estilos começam logo abaixo daqui...


// ========== ESTILOS E AUXILIARES (FORA DO APP) ==========

const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const calcTotal = (list, p) => {
  if (!list || !Array.isArray(list)) return 0; // Proteção se a lista sumir
  const h = new Date().toLocaleDateString("pt-BR");
  const m = new Date().getMonth();
  
  return list.filter(t => {
    if (!t.data) return false; // Ignora se não tiver data
    const d = new Date(t.data);
    return (p === "hoje" ? d.toLocaleDateString("pt-BR") === h : d.getMonth() === m) && t.tipo === "receita";
  }).reduce((acc, c) => acc + (Number(c.valor) || 0), 0); // Garante que c.valor seja número
};

const inputStyle = { width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" };
const btnStyle = { width: "100%", padding: "14px", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cardStyle = { padding: "15px", borderRadius: "12px", marginBottom: "15px", backgroundColor: "#fff" };
const itemStyle = { display: "flex", alignItems: "center", padding: "12px", borderBottom: "1px solid #eee" };
const modalOverlay = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3000 };
const modalContent = { backgroundColor: "#fff", padding: "20px", borderRadius: "15px", width: "90%", maxWidth: "350px" };
const dropdownStyle = { backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "10px" };
const dropdownItem = { padding: "10px", cursor: "pointer", borderBottom: "1px solid #eee" };
const labelStyle = { fontSize: "12px", fontWeight: "bold", display: "block", marginBottom: "5px" };
const btnMini = { padding: "5px 10px", borderRadius: "5px", border: "none", cursor: "pointer" };
const btnEdit = { backgroundColor: "#e3f2fd", color: "#2196f3", border: "none", padding: "5px", borderRadius: "4px", cursor: "pointer" };
const btnDel = { backgroundColor: "#ffebee", color: "#f44336", border: "none", padding: "5px", borderRadius: "4px", cursor: "pointer", marginLeft: "5px" };
const btnWhatsApp = { backgroundColor: "#e8f5e9", color: "#2e7d32", border: "none", padding: "5px", borderRadius: "4px", cursor: "pointer", marginRight: "5px" };
const btnPay = { backgroundColor: "#fff3e0", color: "#ef6c00", border: "none", padding: "5px", borderRadius: "4px", cursor: "pointer", marginRight: "5px" };
const btnLetter = (active) => ({ padding: "5px", minWidth: "25px", backgroundColor: active ? "#d81b60" : "#eee", color: active ? "#fff" : "#000", border: "none", borderRadius: "4px", cursor: "pointer" });
