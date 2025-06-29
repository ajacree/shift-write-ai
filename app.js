import React, { useState, useEffect } from 'react';
import { Clipboard, DollarSign, Users, BookUser, Award, AlertTriangle, Wrench, Loader, Sparkles, LogIn, UserPlus, LogOut, History, Eye, Target, Send } from 'lucide-react';

// --- Firebase SDK Imports ---
// This code is now ready to connect to a real Firebase project.
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    orderBy,
    Timestamp
} from 'firebase/firestore';


// --- Firebase Configuration ---
// IMPORTANT: To make this app live, you must create a free Firebase project
// and paste your unique configuration keys here.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// --- Initialize Firebase ---
// This code will connect to your Firebase project once you've added your config keys
// and deployed the app.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [view, setView] = useState('loading'); // loading, auth, app, history
    const [authView, setAuthView] = useState('login'); // 'login', 'signup'
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Form and Report States
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        totalSales: '', 
        totalGuests: '', 
        laborDollars: '',
        lastYearSales: '',
        weeklyForecast: '', 
        weeklyLaborBudget: '',
        recipientEmail: '', 
        attendance: '', 
        discipline: '', 
        teamworkSpotlight: '',
        notes: '',
    });
    const [generatedSummary, setGeneratedSummary] = useState('');
    const [reportError, setReportError] = useState('');
    const [copySuccess, setCopySuccess] = useState('');
    const [history, setHistory] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);


    // --- Real Authentication Logic ---
    useEffect(() => {
        // This is the listener that checks if a user is logged in or out.
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setView('app');
                fetchHistory(currentUser.uid);
            } else {
                setUser(null);
                setView('auth');
            }
        });
        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    const handleAuthAction = async (action) => {
        setAuthError('');
        setIsLoading(true);
        try {
             if (action === 'signup') {
                await createUserWithEmailAndPassword(auth, email, password);
             } else { // login
                await signInWithEmailAndPassword(auth, email, password);
             }
             // onAuthStateChanged will handle setting the view
        } catch (e) {
            setAuthError(e.message.replace('Firebase: ', ''));
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLogout = async () => {
        await signOut(auth);
    };


    // --- Real Firestore Logic ---
    const saveReport = async (summary) => {
        if (!user) return;
        const reportsCollection = collection(db, 'reports');
        await addDoc(reportsCollection, {
            ...formData,
            summary,
            userId: user.uid,
            createdAt: Timestamp.now()
        });
        await fetchHistory(user.uid); // Refresh history after saving
    };

    const fetchHistory = async (userId) => {
        if (!userId) return;
        setIsLoading(true);
        const reportsCollection = collection(db, 'reports');
        const q = query(reportsCollection, where("userId", "==", userId), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const userReports = querySnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            // Convert Firestore Timestamp to JS Date for display
            date: doc.data().date 
        }));
        setHistory(userReports);
        setIsLoading(false);
    };


    // --- App Logic ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: value }));
    };

    const handleGenerateSummary = async () => {
        setIsLoading(true);
        setGeneratedSummary('');
        setReportError('');
        setCopySuccess('');

        if (!formData.totalSales || !formData.date) {
            setReportError('Please fill in at least the Date and Total Sales.');
            setIsLoading(false);
            return;
        }
        
        const prompt = `
            You are an AI assistant for a restaurant owner, acting as an expert analyst. Your job is to take raw data from the on-duty manager and transform it into a clear, insightful, and actionable EOD summary.
            The tone should be conversational but professional, like a trusted GM giving a direct briefing. Avoid jargon where possible. The structure should be easy to scan, not a wall of text. Use bullet points within sections.

            **Your first task is to calculate key metrics:**
            1.  **Labor Percent:** Calculate by dividing Labor Dollars by Total Sales.
            2.  **Per Person Average (PPA):** Calculate by dividing Total Sales by Total Guests.

            **Then, generate the summary using this exact structure:**

            **Subject: EOD Report - [Date]**

            Good evening, here is the breakdown of tonight's shift.

            **Quick Stats:**
            * **Sales:** $${formData.totalSales}
            * **Guests:** ${formData.totalGuests}
            * **PPA (Per Person Average):** [Your Calculated Value]
            * **Labor:** [Your Calculated Labor %] ($${formData.laborDollars})

            **The Bottom Line (Performance Analysis):**
            * **Sales:** In this section, analyze the sales volume. Compare it to the same day last year and the weekly forecast if provided.
            * **Guest Spending (PPA):** Analyze the calculated PPA. Is it a strong number? A high PPA is great and might mean servers are upselling effectively. A low PPA might be a coaching opportunity.
            * **Labor Control:** Analyze the calculated labor percentage and dollar amount. How does this impact the weekly labor budget? Acknowledge that a higher percentage on a high-volume day can be acceptable, while a high percentage on a slow day is a concern that needs managing.

            **Team Work Spotlight:**
            * Summarize the positive notes about teamwork, unity, and effort provided by the manager. Use bullet points for specific examples.

            **Areas for Improvement:**
            * Summarize any disciplinary or attendance issues professionally and factually.

            **Critical Recommendations (Action Items):**
            * Create a bulleted list of clear, actionable recommendations based on the "General / Maintenance Notes". If there are no notes, state "No critical action items tonight."

            Best,
            Shift-Write AI

            **--- Raw Manager Notes for Reference ---**
            [Include the raw notes from the manager here]
            
            RAW DATA FOR ANALYSIS:
            - Date: ${new Date(formData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            - Total Sales: $${formData.totalSales}
            - Total Guests: ${formData.totalGuests}
            - Labor Dollars: $${formData.laborDollars}
            - Weekly Sales Forecast: ${formData.weeklyForecast || 'Not provided.'}
            - Same Day Last Year Sales: ${formData.lastYearSales || 'Not provided.'}
            - Weekly Labor Budget: ${formData.weeklyLaborBudget || 'Not provided.'}
            - Attendance: ${formData.attendance || 'All staff present.'}
            - Discipline: ${formData.discipline || 'None.'}
            - Teamwork Spotlight Notes: ${formData.teamworkSpotlight || 'A smooth, standard shift.'}
            - General / Maintenance Notes: ${formData.notes || 'No issues to report.'}
        `;

        try {
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
            const apiKey = ""; // This will be handled by environment variables in deployment
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API call failed: ${response.status}`);
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                const summaryText = result.candidates[0].content.parts[0].text;
                setGeneratedSummary(summaryText);
                await saveReport(summaryText);
            } else { throw new Error("Invalid AI response."); }
        } catch (e) {
            setReportError(`Generation failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopyToClipboard = (text) => {
        if (!text) return;
        const textArea = document.createElement("textarea");
        // Clean up the text for pasting
        const cleanText = text
            .replace(/<br \/>/g, '\n')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*/g, '');
        textArea.value = cleanText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopySuccess('Copied to clipboard!');
            setTimeout(() => setCopySuccess(''), 2000);
        } catch (err) {
            setCopySuccess('Failed to copy');
        }
        document.body.removeChild(textArea);
    };

    const handleSendEmail = () => {
        if (!generatedSummary || !formData.recipientEmail) {
            setReportError("Please enter a recipient email and generate a summary first.");
            return;
        }
        const subjectMatch = generatedSummary.match(/Subject: (.*)/);
        const subject = subjectMatch ? subjectMatch[1] : `EOD Shift Summary - ${new Date(formData.date).toLocaleDateString()}`;

        const body = generatedSummary
            .replace(/Subject: .*\n/, '')
            .replace(/<br \/>/g, '\n')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*/g, '•'); // Use bullet points for email body

        const mailtoLink = `mailto:${formData.recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    };

    // --- Render Components ---
    const AuthComponent = () => (
        <div className="max-w-md mx-auto mt-10 bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
            <h1 className="text-3xl font-bold text-cyan-400 tracking-tight text-center mb-2">Shift-Write AI</h1>
            <h2 className="text-2xl font-bold text-white text-center mb-6">{authView === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <div className="space-y-4">
                <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
                <button onClick={() => handleAuthAction(authView)} disabled={isLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {isLoading ? <Loader className="animate-spin"/> : (authView === 'login' ? <><LogIn/>Log In</> : <><UserPlus/>Sign Up</>)}
                </button>
            </div>
            <p className="text-center text-slate-400 mt-6 text-sm">
                {authView === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="font-semibold text-cyan-400 hover:text-cyan-300 ml-1">
                    {authView === 'login' ? 'Sign Up' : 'Log In'}
                </button>
            </p>
        </div>
    );

    const AppComponent = () => (
        <div className="max-w-7xl mx-auto">
             <AppHeader />
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-700 space-y-6">
                    <h2 className="text-2xl font-semibold text-cyan-300 border-b border-slate-600 pb-3">Shift Data Input</h2>
                    <InputField id="date" name="date" label="Date" value={formData.date} onChange={handleChange} type="date" Icon={() => <span className="text-xl">📅</span>} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <InputField id="totalSales" name="totalSales" label="Total Sales" value={formData.totalSales} onChange={handleChange} placeholder="$0.00" type="number" Icon={DollarSign} />
                       <InputField id="totalGuests" name="totalGuests" label="Total Guests" value={formData.totalGuests} onChange={handleChange} placeholder="0" type="number" Icon={Users} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <InputField id="laborDollars" name="laborDollars" label="Labor Dollars" value={formData.laborDollars} onChange={handleChange} placeholder="$0.00" type="number" Icon={DollarSign} />
                       <InputField id="weeklyLaborBudget" name="weeklyLaborBudget" label="Weekly Labor Budget" value={formData.weeklyLaborBudget} onChange={handleChange} placeholder="$0.00" type="number" Icon={DollarSign} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField id="weeklyForecast" name="weeklyForecast" label="Weekly Sales Forecast" value={formData.weeklyForecast} onChange={handleChange} placeholder="$0.00" type="number" Icon={Target} />
                       <InputField id="lastYearSales" name="lastYearSales" label="Same Day Last Year Sales" value={formData.lastYearSales} onChange={handleChange} placeholder="$0.00" type="number" Icon={() => <span className="text-xl">📈</span>} />
                    </div>
                    <InputField id="attendance" name="attendance" label="Employee Attendance" value={formData.attendance} onChange={handleChange} placeholder="e.g., Emily called out sick" type="textarea" Icon={BookUser} />
                    <InputField id="discipline" name="discipline" label="Disciplinary Notes" value={formData.discipline} onChange={handleChange} placeholder="e.g., Verbal warning to Mike..." type="textarea" Icon={AlertTriangle} />
                    <InputField id="teamworkSpotlight" name="teamworkSpotlight" label="Team Work Spotlight" value={formData.teamworkSpotlight} onChange={handleChange} placeholder="e.g., Jessica received a compliment..." type="textarea" Icon={Award} />
                    <InputField id="notes" name="notes" label="General / Maintenance Notes" value={formData.notes} onChange={handleChange} placeholder="e.g., Low on Ketel One..." type="textarea" Icon={Wrench} />
                    <button onClick={handleGenerateSummary} disabled={isLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        {isLoading ? <><Loader className="animate-spin"/> Generating...</> : <><Sparkles size={20}/> Generate Summary</>}
                    </button>
                 </div>
                 <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-700">
                    <div className="border-b border-slate-600 pb-3 mb-4">
                        <h2 className="text-2xl font-semibold text-cyan-300 mb-4">Generated Summary & Actions</h2>
                        <InputField id="recipientEmail" name="recipientEmail" label="Recipient Email Address" value={formData.recipientEmail} onChange={handleChange} placeholder="e.g., owner@restaurant.com" type="email" Icon={Send} />
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => handleCopyToClipboard(generatedSummary)} disabled={!generatedSummary} className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
                                <Clipboard size={16}/> Copy
                            </button>
                             <button onClick={handleSendEmail} disabled={!generatedSummary || !formData.recipientEmail} className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
                                <Send size={16}/> Send via Email
                            </button>
                        </div>
                    </div>
                    {copySuccess && <div className="text-center text-green-400 mb-4">{copySuccess}</div>}
                    {reportError && <div className="text-center text-red-400 mb-4">{reportError}</div>}
                    <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-white prose-strong:text-cyan-400 bg-slate-900 p-4 rounded-lg min-h-[400px] whitespace-pre-wrap overflow-y-auto">
                        {generatedSummary ? <div dangerouslySetInnerHTML={{ __html: generatedSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} /> : <div className="flex items-center justify-center h-full"><p className="text-slate-500">Your professional EOD summary will appear here.</p></div>}
                    </div>
                 </div>
             </div>
        </div>
    );
    
     const HistoryComponent = () => (
        <div className="max-w-7xl mx-auto">
             <AppHeader />
             <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-700">
                <h2 className="text-2xl font-semibold text-cyan-300 border-b border-slate-600 pb-3 mb-4">Report History</h2>
                {isLoading ? <div className="text-center p-4"><Loader className="animate-spin inline-block"/></div> : history.length === 0 ? <p className="text-slate-400 text-center p-4">No reports saved yet. Generate a summary to start your history.</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map((report) => (
                            <div key={report.id} className="bg-slate-900 p-4 rounded-lg flex flex-col justify-between">
                                <div>
                                    <p className="font-bold text-white">{new Date(report.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    <p className="text-sm text-slate-400">Sales: ${report.totalSales}</p>
                                    <p className="text-sm text-slate-400 truncate">{report.summary.substring(0, 50)}...</p>
                                </div>
                                <button onClick={() => setSelectedReport(report)} className="mt-4 w-full text-sm bg-cyan-700 hover:bg-cyan-600 text-white font-semibold py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2">
                                    <Eye size={14}/> View Report
                                </button>
                            </div>
                        ))}
                    </div>
                )}
             </div>
             {selectedReport && <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />}
        </div>
    );
    
    const ReportModal = ({ report, onClose }) => (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 max-w-3xl w-full rounded-2xl shadow-2xl border border-slate-700 max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-600 flex justify-between items-center">
                    <h3 className="text-2xl font-semibold text-cyan-300">Report for {new Date(report.date).toLocaleDateString()}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto prose prose-invert prose-p:text-slate-300 prose-headings:text-white prose-strong:text-cyan-400">
                    <div dangerouslySetInnerHTML={{ __html: report.summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
                </div>
                <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end gap-2">
                    <button onClick={() => handleCopyToClipboard(report.summary)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors">
                        <Clipboard size={16}/> Copy Text
                    </button>
                    <button onClick={onClose} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg">Close</button>
                </div>
            </div>
        </div>
    );

    const AppHeader = () => (
        <header className="flex justify-between items-center mb-8">
            <div>
                 <h1 className="text-3xl font-bold text-cyan-400 tracking-tight">Shift-Write AI</h1>
                 <p className="text-slate-400">{user?.email}</p>
            </div>
            <nav className="flex items-center gap-4">
                 <button onClick={() => setView('app')} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${view === 'app' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Dashboard</button>
                 <button onClick={() => setView('history')} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${view === 'history' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>History</button>
                 <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><LogOut size={16}/> Logout</button>
            </nav>
        </header>
    );

    const InputField = ({ id, name, label, value, onChange, placeholder, type = 'text', Icon }) => (
        <div>
            <label htmlFor={id} className="flex items-center gap-2 text-lg font-semibold mb-2 text-slate-300">
                <Icon className="h-6 w-6 text-cyan-400" />
                {label}
            </label>
            {type === 'textarea' ? (
                <textarea id={id} name={name} value={value} onChange={onChange} placeholder={placeholder} rows="3" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
            ) : (
                <input id={id} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
            )}
        </div>
    );
    
    // Main View Router
    return (
        <div className="bg-slate-900 min-h-screen text-white font-sans p-4 sm:p-6 lg:p-8">
            {view === 'loading' && <div className="flex justify-center items-center h-screen"><Loader className="animate-spin" size={48}/></div>}
            {view === 'auth' && <AuthComponent />}
            {view === 'app' && <AppComponent />}
            {view === 'history' && <HistoryComponent />}
        </div>
    );
}
