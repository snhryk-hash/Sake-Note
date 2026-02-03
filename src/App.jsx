import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { 
  Camera, 
  Plus, 
  Wine, 
  Save, 
  X, 
  Trash2, 
  Loader2, 
  Star,
  StarHalf,
  Grape, 
  Globe, 
  Image as ImageIcon,
  ArrowUpDown,
  ExternalLink,
  Beer,
  Martini,
  AlignLeft,
  Store,
  Tag,
  LogOut,
  LogIn,
  Settings,
  AlertTriangle,
  Clock
} from 'lucide-react';

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h2>
          <div className="bg-gray-100 p-4 rounded-lg w-full max-w-sm text-left mb-6 overflow-auto max-h-40">
             <p className="text-xs font-mono text-red-600 break-all">{this.state.error?.toString()}</p>
          </div>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-500 transition-colors">再読み込み</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyA1UWwPTjNV4fyoWZ82p2jmDsUBTsQy3fc",
  authDomain: "sake-note-c64ec.firebaseapp.com",
  projectId: "sake-note-c64ec",
  storageBucket: "sake-note-c64ec.firebasestorage.app",
  messagingSenderId: "1016216220232",
  appId: "1:1016216220232:web:26bd0403c074f84025de7d"
};

let app, auth, db;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase init error", e);
}

const appId = "sake-note-c64ec";

// --- Gemini API Configuration ---
const GEMINI_API_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;

const LIQUOR_CATEGORIES = {
  'ワイン': {
    types: ['赤', '白', 'ロゼ', 'スパークリング',  'その他'],
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    typeColor: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: Wine,
    keywords: ['wine', 'ワイン', '赤', '白', 'ロゼ', 'brut', 'chateau', 'domaine']
  },
  '日本酒': {
    types: ['純米大吟醸', '純米吟醸', '純米', '特別純米', '大吟醸', '吟醸', '本醸造', '特別本醸造', '普通', 'その他'],
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    typeColor: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: Martini,
    keywords: ['sake', '日本酒', '清酒', '純米', '吟醸', '本醸造']
  },
  '焼酎': {
    types: ['芋', '麦', '米', 'その他'],
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    typeColor: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: Beer,
    keywords: ['shochu', '焼酎', '泡盛', '芋', '麦']
  },
  'ビール': {
    types: ['ラガー', 'エール', 'その他'],
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    typeColor: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    icon: Beer,
    keywords: ['beer', 'ビール', '発泡酒', 'ipa', 'lager', 'ale', 'stout']
  },
  'その他': {
    types: ['ウイスキー', '果実酒', 'その他'],
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    typeColor: 'bg-gray-50 text-gray-700 border-gray-100',
    icon:  Martini,
    keywords: ['whisky', 'whiskey', 'ウイスキー', 'liqueur', 'リキュール', 'gin', 'vodka', 'rum', 'tequila', '梅酒']
  }
};

// --- Helper Functions ---
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1200; 
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const displayValue = (val) => {
    if (typeof val === 'object') return ''; 
    if (!val || val === 'N/A' || val === '不明') return '';
    return val;
};

// --- Sub-Components ---
const RatingInput = ({ value, onChange, readOnly = false, showLabel = true }) => {
  const displayValue = value > 5 ? value / 2 : value;
  const starSize = readOnly ? "w-3 h-3 md:w-4 md:h-4" : "w-10 h-10"; 
  const containerGap = readOnly ? "gap-1" : "gap-3";

  return (
    <div className={`flex items-center ${containerGap} ${!showLabel ? 'justify-center' : ''}`}>
      <div className={`flex relative ${containerGap}`}>
        {[1, 2, 3, 4, 5].map((index) => {
          const isFull = displayValue >= index;
          const isHalf = displayValue >= index - 0.5 && displayValue < index;
          return (
            <div key={index} className={`relative ${starSize} ${!readOnly ? "cursor-pointer" : ""}`}>
              <Star className="w-full h-full text-gray-200 absolute top-0 left-0" />
              {isFull && <Star className="w-full h-full text-yellow-400 fill-current absolute top-0 left-0" />}
              {isHalf && <div className="absolute top-0 left-0 w-full h-full overflow-hidden"><StarHalf className="w-full h-full text-yellow-400 fill-current" /></div>}
              {!readOnly && (
                <>
                  <div className="absolute left-0 top-0 w-1/2 h-full z-10" onClick={() => onChange(index - 0.5)} />
                  <div className="absolute right-0 top-0 w-1/2 h-full z-10" onClick={() => onChange(index)} />
                </>
              )}
            </div>
          );
        })}
      </div>
      {showLabel && <span className={`font-bold text-gray-600 ${readOnly ? "text-xs w-6 text-right" : "text-lg ml-2"}`}>{Number(displayValue).toFixed(1)}</span>}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col`}>
        <div className="flex justify-between items-center p-5 border-b border-gray-100 sticky top-0 bg-white z-20">
          <h2 className="text-lg font-bold text-gray-800 line-clamp-1">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// 詳細表示コンポーネント (リッチデザイン)
const LiquorDetailView = ({ liquor, onEdit }) => {
  const categoryConfig = LIQUOR_CATEGORIES[liquor.category] || LIQUOR_CATEGORIES['その他'];
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3 flex-shrink-0">
          {liquor.thumbnail ? (
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-inner"><img src={liquor.thumbnail} alt={liquor.name} className="w-full h-auto object-contain max-h-[400px]" /></div>
          ) : (
            <div className="w-full h-48 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 border border-gray-200"><ImageIcon className="w-12 h-12" /></div>
          )}
        </div>
        <div className="w-full md:w-2/3 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${categoryConfig.color}`}>{liquor.category}</span>
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">{liquor.type || 'タイプ不明'}</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900 leading-tight mb-2 flex items-center gap-2">
              {liquor.name}
              <a href={`https://www.google.com/search?q=${encodeURIComponent(liquor.name + ' ' + (liquor.category || ''))}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-600"><ExternalLink className="w-6 h-6" /></a>
            </h3>
            <p className="text-lg text-gray-500 font-medium">{liquor.producer}</p>
          </div>
          <div className="flex items-center gap-6 py-3 border-y border-gray-100">
             <div className="flex items-center gap-2"><span className="text-sm font-bold text-gray-400">RATING</span><RatingInput value={liquor.rating} readOnly /></div>
             <div className="h-6 w-px bg-gray-200"></div>
             <div className="flex items-center gap-2"><span className="text-sm font-bold text-gray-400">VINTAGE</span><span className="text-lg font-bold text-gray-700">{liquor.vintage || ''}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-y-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-indigo-400" /><span className="font-bold">産地:</span><span>{liquor.country} {liquor.region ? `/ ${liquor.region}` : ''}</span></div>
            <div className="flex items-center gap-2"><Grape className="w-4 h-4 text-indigo-400" /><span className="font-bold">品種:</span><span>{liquor.grape || '-'}</span></div>
            <div className="flex items-center gap-2"><Store className="w-4 h-4 text-indigo-400" /><span className="font-bold">購入:</span><span>{liquor.shop || '-'}</span></div>
            <div className="flex items-center gap-2"><Tag className="w-4 h-4 text-indigo-400" /><span className="font-bold">価格:</span><span>{liquor.priceRange || '-'}</span></div>
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-2">
        {liquor.memo && (
          <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-100 shadow-sm">
             <div className="flex items-center gap-2 mb-3 text-yellow-800 font-bold text-base"><AlignLeft className="w-5 h-5" />MY MEMO</div>
             <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{liquor.memo}</p>
          </div>
        )}
        {liquor.description && (
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
             <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold text-base"><Wine className="w-5 h-5" />AI SOMMELIER REVIEW</div>
             <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm md:text-base">{liquor.description}</p>
          </div>
        )}
      </div>
      <div className="flex justify-end pt-4 border-t border-gray-100">
         <button onClick={() => onEdit(liquor)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-bold shadow-md transition-all">編集する</button>
      </div>
    </div>
  );
};

const LiquorListItem = ({ liquor, onDelete, onEdit, onSelect }) => {
  const categoryConfig = LIQUOR_CATEGORIES[liquor.category] || LIQUOR_CATEGORIES['その他'];
  const badgeClass = categoryConfig.color;
  const typeBadgeClass = categoryConfig.typeColor;
  
  return (
    <tr className="hover:bg-indigo-50/20 transition-colors">
      <td className="p-3 border text-center">
        {/* 写真クリック時のみ詳細を表示 */}
        <button onClick={() => onSelect(liquor)} className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 mx-auto mb-1 shadow-sm hover:scale-105 transition-transform">
          {liquor.thumbnail ? <img src={liquor.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-8 h-8" /></div>}
        </button>
        <div className="flex justify-center"><RatingInput value={liquor.rating} readOnly showLabel={false} /></div>
      </td>
      <td className="p-3 border text-center align-middle">
        <div className="flex flex-col gap-1.5 items-center">
          <span className={`text-[10px] font-bold py-1 rounded-md border text-center w-full px-2 shadow-sm ${categoryConfig.color}`}>{liquor.category}</span>
          <span className={`text-[10px] font-medium py-1 rounded-md border text-center w-full px-2 shadow-sm whitespace-nowrap ${categoryConfig.typeColor}`}>{liquor.type}</span>
        </div>
      </td>
      {/* 銘柄/生産者の幅を制限し、中央揃えに */}
      <td className="p-3 border align-middle text-center w-[200px]">
        <div className="flex flex-col items-center gap-1">
          <a 
            href={`https://www.google.com/search?q=${encodeURIComponent(liquor.name + ' ' + (liquor.category || ''))}`}
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm font-bold text-gray-900 hover:text-indigo-600 hover:underline block truncate max-w-full"
            onClick={(e) => e.stopPropagation()} 
          >
            {displayValue(liquor.name)}
          </a>
          <span className="text-[10px] text-gray-400 block truncate max-w-full">{displayValue(liquor.producer)}</span>
        </div>
      </td>
      <td className="p-3 border text-xs text-center align-middle w-32">
        <span className="line-clamp-1 truncate block max-w-[120px] mx-auto">{displayValue(liquor.grape)}</span>
      </td>
      <td className="p-3 border text-xs text-center align-middle leading-tight w-32"><div className="flex flex-col items-center"><span className="font-bold text-gray-700">{displayValue(liquor.country)}</span>{liquor.region && <span className="text-[10px] text-gray-400 mt-1">{liquor.region}</span>}</div></td>
      {/* メモを1行表示、幅を確保 */}
      <td className="p-3 border text-xs text-gray-500 align-middle text-center min-w-[150px]">
         <div className="line-clamp-1 max-w-[200px] mx-auto overflow-hidden text-ellipsis whitespace-nowrap">
           {displayValue(liquor.memo)}
         </div>
      </td>
      <td className="p-3 border text-center align-middle">
        <div className="flex flex-col gap-3 items-center justify-center">
          <button onClick={() => onEdit(liquor)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"><Tag className="w-5 h-5" /></button>
          <button onClick={() => onDelete(liquor.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-5 h-5" /></button>
        </div>
      </td>
    </tr>
  );
};

// --- Main App Component ---
function App() {
  const [user, setUser] = useState(null);
  const [liquors, setLiquors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLongLoading, setIsLongLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLiquor, setSelectedLiquor] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('sakenote_gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  
  const [filterCategory, setFilterCategory] = useState('すべて');
  const [filterType, setFilterType] = useState('すべて'); 
  const [sortOrder, setSortOrder] = useState('dateDesc'); 

  const fileInputRef = useRef(null);

  const initialFormState = { category: 'ワイン', name: '', type: '赤', country: '', region: '', grape: '', producer: '', vintage: '', priceRange: '', shop: '', rating: 6, description: '', memo: '', thumbnail: null };
  const [formData, setFormData] = useState(initialFormState);

  // --- Auth Handlers ---
  const handleLogin = async () => {
    if (!auth) {
      alert("Firebaseの設定が正しくありません。");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("ログインに失敗しました。ポップアップがブロックされていないか確認してください。");
    }
  };

  const handleLogout = () => {
    if (auth) signOut(auth);
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsLongLoading(true), 5000);
    return onAuthStateChanged(auth, (u) => { 
      setUser(u); 
      setLoading(false); 
      clearTimeout(timer);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) { setLiquors([]); return; }
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'liquors'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setLiquors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Firestore error:", err));
  }, [user]);

  const handleSaveApiKey = () => {
    localStorage.setItem('sakenote_gemini_api_key', apiKey);
    setShowSettings(false);
    alert('AI機能用のAPIキーを保存しました。');
  };

  const handleDelete = async (id) => {
    if (!confirm("削除しますか？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'liquors', id));
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  // --- Image Upload ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!apiKey) {
      alert("AI機能を使用するには、設定（左上の歯車アイコン）からGoogle APIキーを入力してください。");
      setShowSettings(true);
      return;
    }
    
    setIsScanning(true);
    
    try {
      const base64 = await compressImage(file);
      setFormData(prev => ({ ...prev, thumbnail: base64 }));

      // 日本語のプロンプト（ここを自由に変更してください）
      const prompt = `画像に写っているお酒について詳しく教えてください。JSONで詳細情報を抽出してください。
        【最重要ルール】
        1. カテゴリ、タイプは以下（2,3）の中から選ぶこと。
        2. "category" ："ワイン", "日本酒", "焼酎", "ビール", "その他"
        3. "type" はカテゴリごとに以下の中から選ぶこと。
           - ワイン："赤","白","ロゼ","スパークリング","その他"
           - 日本酒："純米大吟醸","純米吟醸","純米","特別純米","大吟醸","吟醸","本醸造","特別本醸造","普通","その他"
           - 焼酎："芋","麦","米","その他"
           - ビール："ラガー","エール","その他"
           - その他："ウイスキー","果実酒","リキュール","その他"
        
        4. "description"（特徴）は以下のフォーマットで出力すること。各項目の見出しを【 】で囲み、改行で区切ること。
           
           【特徴】
           （製品の概要、産地の特徴など）

           【外観】
           （色調、濃淡、粘性など）
           
           【香り】
           （果実、花、スパイス、樽香などのアロマ）

           【味わい】
           （アタック、酸味、甘み、苦味、渋み、ボディ感、余韻）
           
           【ペアリング】
           （具体的な料理名や食材）

           【熟成】
           （熟成方法、規定、ポテンシャルに関する事実ベースの記述。 Riservaなど等級の解説も含めて具体的に）

        5. "price_estimate": 日本国内での現在の一般的な小売価格帯を記入すること。不明な場合は空白。

        6. "country":生産国を記入すること。不明な場合は空白。

        7. "region":生産地域（都道府県、州など）を記入すること。不明な場合は空白。

        8. "producer":生産者を記入すること。不明な場合は空白。

        9. "grape"：品種を記入すること。複数ある場合はコンマで区切る。不明な場合は空白。
        
        抽出キー: category, name, type, country, region, grape, producer, vintage, description, price_estimate
        JSONのみ返却。不明な項目は空文字("")にすること。`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); 

      const response = await fetch(`${GEMINI_API_BASE_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } }] }],
          generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.0
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0].content) {
        let aiText = data.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json\n?|\n?```/g, '').trim();
        const aiData = JSON.parse(aiText);
        
        let validCategory = 'その他';
        let aiCategory = aiData.category || '';

        if (Object.keys(LIQUOR_CATEGORIES).includes(aiCategory)) {
          validCategory = aiCategory;
        } else {
          for (const [key, config] of Object.entries(LIQUOR_CATEGORIES)) {
            if (aiCategory.includes(key) || (config.keywords && config.keywords.some(k => aiCategory.toLowerCase().includes(k)))) {
              validCategory = key;
              break;
            }
          }
        }

        let validType = aiData.type || LIQUOR_CATEGORIES[validCategory].types[0];
        
        setFormData(prev => ({ 
          ...prev, ...aiData, 
          category: validCategory, 
          type: validType,
          priceRange: aiData.price_estimate || aiData.priceRange || '',
        }));
      } else {
        throw new Error("No data returned from AI");
      }
    } catch (error) { 
      console.error("AI Scan failed", error); 
      alert("解析エラーが発生しました。");
    } finally { 
      setIsScanning(false); 
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'liquors');
    const dataToSave = { ...formData, updatedAt: serverTimestamp() };
    if (editingId) { await updateDoc(doc(colRef, editingId), dataToSave); } 
    else { await addDoc(colRef, { ...dataToSave, createdAt: serverTimestamp() }); }
    setFormData(initialFormState); setEditingId(null); setIsModalOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'category') {
      const newTypes = LIQUOR_CATEGORIES[value]?.types || [];
      setFormData(prev => ({ ...prev, [name]: value, type: newTypes[0] || 'その他' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const filteredLiquors = liquors
    .filter(item => (filterCategory === 'すべて' || item.category === filterCategory) && (filterType === 'すべて' || item.type === filterType))
    .sort((a, b) => {
      if (sortOrder === 'dateDesc') return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      if (sortOrder === 'ratingDesc') return b.rating - a.rating;
      if (sortOrder === 'ratingAsc') return a.rating - b.rating;
      return 0;
    });

  if (loading) return <div className="h-screen flex justify-center items-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!user) return (
    <div className="h-screen flex flex-col justify-center items-center p-4 bg-stone-100">
      <Wine className="w-16 h-16 text-indigo-900 mb-6" />
      <h1 className="text-3xl font-bold text-gray-800 mb-8">SakeNote</h1>
      <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 py-3 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-all"><LogIn className="w-5 h-5" /> Googleでログイン</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-20 font-sans">
      <header className="bg-indigo-50 border-b border-indigo-100 sticky top-0 z-30 px-4 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(!showSettings)} className="bg-white p-2 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><Settings className="w-5 h-5 text-indigo-500" /></button>
            <div><h1 className="text-xl font-bold font-serif leading-none">SakeNote</h1><p className="text-[10px] text-indigo-400">CLOUD SYNC</p></div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setFormData(initialFormState); setEditingId(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md hover:bg-indigo-500 flex items-center gap-1"><Plus className="w-4 h-4" /> 追加</button>
            <button onClick={handleLogout} className="p-2 text-indigo-400 hover:text-red-500"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
        {showSettings && <div className="mb-4 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm animate-fadeIn"><h3 className="text-sm font-bold text-gray-700 mb-2">AI設定</h3><div className="flex gap-2"><input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="AIzaSy..." /><button onClick={handleSaveApiKey} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs">保存</button></div><p className="text-[10px] text-gray-400 mt-1">※キーはブラウザ内にのみ保存されます。</p></div>}
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col w-full">
            <div className="flex overflow-x-auto gap-2 no-scrollbar w-full md:w-auto">
              {['すべて', ...Object.keys(LIQUOR_CATEGORIES)].map(cat => (
                <button key={cat} onClick={() => { setFilterCategory(cat); setFilterType('すべて'); }} className={`px-4 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border-gray-200'}`}>{cat}</button>
              ))}
            </div>
            {filterCategory !== 'すべて' && <div className="flex overflow-x-auto gap-2 no-scrollbar w-full mt-2 animate-fadeIn"><button onClick={() => setFilterType('すべて')} className={`px-3 py-1 rounded text-[10px] font-medium border whitespace-nowrap transition-all ${filterType === 'すべて' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-400 border-gray-100'}`}>全タイプ</button>{LIQUOR_CATEGORIES[filterCategory].types.map(t => <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1 rounded text-[10px] font-medium border whitespace-nowrap transition-all ${filterType === t ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-400 border-gray-100'}`}>{t}</button>)}</div>}
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 self-end md:self-auto"><ArrowUpDown className="w-3 h-3 text-gray-400" /><select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-transparent text-xs font-bold outline-none cursor-pointer"><option value="dateDesc">新しい順</option><option value="ratingDesc">高評価順</option><option value="ratingAsc">低評価順</option></select></div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-left border-collapse border border-gray-200 min-w-[800px]">
            <thead><tr className="bg-orange-50/70 text-gray-700 text-xs font-bold uppercase tracking-wider"><th className="p-3 w-24 text-center border">写真</th><th className="p-3 w-20 text-center border">酒質</th><th className="p-3 border w-[200px] text-center">銘柄 / 生産者</th><th className="p-3 text-center border w-32">品種/原料</th><th className="p-3 text-center border w-32">産地</th><th className="p-3 border text-center">メモ</th><th className="p-3 w-16 text-center border">操作</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filteredLiquors.map(l => <LiquorListItem key={l.id} liquor={l} onDelete={handleDelete} onEdit={(l) => {setFormData(l); setEditingId(l.id); setIsModalOpen(true)}} onSelect={(l) => {setSelectedLiquor(l); setIsDetailOpen(true)}} />)}</tbody>
          </table>
        </div>
      </main>
      <div className="fixed bottom-6 right-6 md:hidden z-40"><button onClick={() => { setFormData(initialFormState); setEditingId(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-500 transition-colors flex items-center justify-center"><Plus className="w-7 h-7" /></button></div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? '編集' : '新規登録'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-indigo-200 rounded-xl cursor-pointer hover:bg-indigo-50 relative overflow-hidden">
            {formData.thumbnail ? <img src={formData.thumbnail} className="h-full object-contain opacity-30 absolute" /> : null}
            <div className="z-10 text-center">{isScanning ? <><Loader2 className="animate-spin text-indigo-600 mb-2 mx-auto" /><p className="text-xs text-indigo-600 font-bold">画像を解析中...</p></> : <><ImageIcon className="mx-auto mb-1 text-indigo-400" /><p className="text-xs text-indigo-600 font-bold">ラベル写真をアップロード (AI自動入力)</p></>}</div>
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><input type="text" placeholder="銘柄名" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-3 rounded-lg font-bold" /></div>
            <select value={formData.category} onChange={handleInputChange} name="category" className="border p-2 rounded-lg">{Object.keys(LIQUOR_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select value={formData.type} onChange={handleInputChange} name="type" className="border p-2 rounded-lg">{LIQUOR_CATEGORIES[formData.category].types.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div className="border-t pt-4"><label className="block text-xs font-bold text-gray-500 mb-2">評価 (5.0満点)</label><RatingInput value={formData.rating} onChange={v => setFormData({...formData, rating:v})} /></div>
          <div className="grid grid-cols-2 gap-4"><input type="text" placeholder="購入場所" value={formData.shop} onChange={e => setFormData({...formData, shop:e.target.value})} className="border p-2 rounded-lg" /><input type="text" placeholder="価格帯" value={formData.priceRange} onChange={e => setFormData({...formData, priceRange:e.target.value})} className="border p-2 rounded-lg" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><textarea placeholder="マイ・メモ (自由入力)" rows="10" value={formData.memo} onChange={e => setFormData({...formData, memo:e.target.value})} className="w-full border p-3 rounded-lg bg-yellow-50" /><textarea placeholder="AI特徴 (自動入力)" rows="10" value={formData.description} onChange={e => setFormData({...formData, description:e.target.value})} className="w-full border p-3 rounded-lg bg-gray-50 text-gray-600" /></div>
          <div className="col-span-1 md:col-span-2 space-y-2">
            <input type="text" placeholder="生産国" value={formData.country} onChange={e => setFormData({...formData, country:e.target.value})} className="w-full border p-2 rounded-lg" />
            <input type="text" placeholder="地域" value={formData.region} onChange={e => setFormData({...formData, region:e.target.value})} className="w-full border p-2 rounded-lg" />
            <input type="text" placeholder="生産者" value={formData.producer} onChange={e => setFormData({...formData, producer:e.target.value})} className="w-full border p-2 rounded-lg" />
            <input type="text" placeholder="品種/原材料" value={formData.grape} onChange={e => setFormData({...formData, grape:e.target.value})} className="w-full border p-2 rounded-lg" />
            <input type="text" placeholder="ヴィンテージ (年)" value={formData.vintage} onChange={e => setFormData({...formData, vintage:e.target.value})} className="w-full border p-2 rounded-lg" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Save className="w-5 h-5" /> 保存する</button>
        </form>
      </Modal>
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="詳細情報">{selectedLiquor && <LiquorDetailView liquor={selectedLiquor} onEdit={(l) => { setFormData(l); setEditingId(l.id); setIsDetailOpen(false); setIsModalOpen(true); }} />}</Modal>
    </div>
  );
}

// Wrap with Error Boundary
export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}