
/* ============================================================ CONFIG */
const CONFIG = { mode:"direct", model:"llama-3.3-70b-versatile", backendUrl:"/api/message" };

/* ============================================================ STATE */
const STATE = {
  profil:"", profilIco:"i-backpack", niveau:"", serie:"", matiere:"",
  matiereIco:"", matColor:"var(--orange)", tab:"cours",
  isGuest:false, pendingAction:null
};

/* ============================================================ STORAGE */
const USERS_KEY="ecole_ia_users", SESSION_KEY="ecole_ia_session", HIST_KEY="ecole_ia_hist";
function getUsers(){try{return JSON.parse(localStorage.getItem(USERS_KEY)||"{}");}catch(e){return {};}}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u));}
function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null");}catch(e){return null;}}
function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s));}
function clearSession(){localStorage.removeItem(SESSION_KEY);}
function isLoggedIn(){return !!getSession();}
function getHistStore(){try{return JSON.parse(localStorage.getItem(HIST_KEY)||"{}");}catch(e){return {};}}
function saveHistStore(h){localStorage.setItem(HIST_KEY,JSON.stringify(h));}
function getUserHistKey(){const s=getSession();return s?s.id:"__guest__";}
function loadUserHistory(){const store=getHistStore();const key=getUserHistKey();return store[key]||[];}
function saveUserHistory(sessions){const store=getHistStore();const key=getUserHistKey();store[key]=sessions;saveHistStore(store);}

/* ============================================================ ICON HELPERS */
function iconSvg(id,cls){return `<svg class="ico ${cls||''}" viewBox="0 0 24 24"><use href="#${id}"/></svg>`;}

/* ============================================================ PANNEAUX (style VS Code) */
let histOpen=false, aiOpen=false, aiPanelWidth=380;

function updateRail(){
  const hb=document.getElementById("railHist"), ab=document.getElementById("railAI");
  if(hb) hb.classList.toggle("active",histOpen);
  if(ab) ab.classList.toggle("active",aiOpen);
  const badge=document.getElementById("railHistBadge");
  if(badge){
    const n=loadUserHistory().length;
    badge.style.display=n>0?"grid":"none";
    badge.textContent=n>9?"9+":n;
  }
}

function toggleHistory(){
  histOpen=!histOpen;
  document.getElementById("historySidebar").classList.toggle("open",histOpen);
  if(histOpen) renderHistoryPanel();
  updateRail();
}

function toggleAI(){
  aiOpen=!aiOpen;
  const panel=document.getElementById("aiPanel");
  panel.classList.toggle("open",aiOpen);
  document.getElementById("resizer").classList.toggle("show",aiOpen);
  if(aiOpen){
    panel.style.width=aiPanelWidth+"px";
    setTimeout(()=>document.getElementById("chatInput").focus(),200);
  }
  updateRail();
}

function closeAllDrawers(){
  histOpen=false; aiOpen=false;
  const hs=document.getElementById("historySidebar"); if(hs) hs.classList.remove("open");
  const ap=document.getElementById("aiPanel"); if(ap) ap.classList.remove("open");
  const rz=document.getElementById("resizer"); if(rz) rz.classList.remove("show");
  updateRail();
}

/* ── Redimensionnement (drag) du panneau IA ── */
(function initResizer(){
  document.addEventListener("DOMContentLoaded",setup);
  if(document.readyState!=="loading") setup();
  function setup(){
    const resizer=document.getElementById("resizer");
    const panel=document.getElementById("aiPanel");
    const ws=document.getElementById("workspace");
    if(!resizer||!panel||!ws||resizer.dataset.init) return;
    resizer.dataset.init="1";
    let dragging=false;
    const getX=e=>e.touches?e.touches[0].clientX:e.clientX;
    function start(e){dragging=true;resizer.classList.add("dragging");document.body.style.userSelect="none";}
    function move(e){
      if(!dragging)return;
      const rect=ws.getBoundingClientRect();
      let w=rect.right-getX(e);
      w=Math.max(300,Math.min(w,rect.width*0.72));
      aiPanelWidth=w; panel.style.width=w+"px";
    }
    function end(){dragging=false;resizer.classList.remove("dragging");document.body.style.userSelect="";}
    resizer.addEventListener("mousedown",start);
    window.addEventListener("mousemove",move);
    window.addEventListener("mouseup",end);
    resizer.addEventListener("touchstart",start,{passive:true});
    window.addEventListener("touchmove",move,{passive:true});
    window.addEventListener("touchend",end);
  }
})();

/* ============================================================ TOPBAR */
function updateTopbarActions(){
  const who=document.getElementById("topbarActions");
  let html="";
  if(STATE.profil){
    const connected=isLoggedIn();
    html+=`${connected?'<span class="badge-connected">'+iconSvg('i-checkbadge')+'</span>':''}
    <span class="pill-user">${iconSvg(STATE.profilIco)} ${STATE.profil}</span>
    <button class="btn btn-ghost" style="padding:.35rem .85rem;font-size:.8rem" onclick="logout()">Quitter</button>`;
  }
  who.innerHTML=html;
}

/* ============================================================ MATIERES DEF */
const MATIERES_DEF = [
  {n:"Mathématiques",e:"i-divide",c:"var(--orange)",d:"Algèbre, géométrie, fonctions"},
  {n:"Mathématiques_1C",e:"i-divide",c:"var(--orange)",d:"Second degré, barycentre, fonctions"},
  {n:"Physique-Chimie",e:"i-flask",c:"#7048e8",d:"Forces, matière, transformations"},
  {n:"SVT",e:"i-leaf",c:"#2b8a3e",d:"Vie, corps, environnement"},
  {n:"Français",e:"i-quill",c:"var(--green)",d:"Grammaire, textes, rédaction"},
  {n:"Histoire",e:"i-scroll",c:"#1864ab",d:"Passé humain, citoyenneté"},
  {n:"Géographie",e:"i-globe",c:"#1864ab",d:"Espace, milieux, sociétés"},
  {n:"Anglais",e:"i-uk",c:"#c2255c",d:"Vocabulaire, grammaire, oral"},
  {n:"Philosophie",e:"i-brain",c:"#5f3dc4",d:"Notions, dissertation, méthode"},
];

/* ============================================================ HISTORY PANEL */
function saveCurrentChatToHistory(matiere,niveau,serie,messages){
  if(!messages||messages.length<2)return;
  const sessions=loadUserHistory();
  const firstUser=messages.find(m=>m.role==="user");
  const preview=firstUser?firstUser.content.substring(0,80):"(conversation)";
  const entry={id:Date.now(),matiere,niveau,serie,preview,messages:messages.slice(0,40),savedAt:new Date().toISOString()};
  sessions.unshift(entry);
  if(sessions.length>20)sessions.splice(20);
  saveUserHistory(sessions);
  renderHistoryPanel();
  updateRail();
}

function renderHistoryPanel(){
  const list=document.getElementById("historyList");
  if(!list)return;
  const sessions=loadUserHistory();
  if(!sessions.length){
    list.innerHTML=`<div class="hist-empty">${iconSvg('i-chat')}Aucune session sauvegardée.<br>Tes conversations avec Akwaba apparaîtront ici.</div>`;
    return;
  }
  list.innerHTML=sessions.map((s,i)=>{
    const mIconId=(MATIERES_DEF.find(m=>m.n===s.matiere)||{e:"i-book-open"}).e;
    const d=new Date(s.savedAt);
    const dateStr=d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
    return `<div class="hist-item" onclick="restoreSession(${i})">
      <div class="hi-ico">${iconSvg(mIconId)}</div>
      <div class="hi-meta">
        <div class="hi-mat">${s.matiere==="Mathématiques_1C"?"Mathématiques":s.matiere} · ${s.niveau}${s.serie?" "+s.serie:""}</div>
        <div class="hi-preview">${esc(s.preview)}</div>
        <div class="hi-date">${iconSvg('i-history')} ${dateStr} · ${s.messages.length} msg</div>
      </div>
    </div>`;
  }).join("");
}

function restoreSession(idx){
  const sessions=loadUserHistory();
  const s=sessions[idx];
  if(!s)return;
  chatHistory=s.messages||[];
  const chatBody=document.getElementById("chatBody");
  chatBody.innerHTML="";
  chatHistory.forEach(m=>{
    addMsg(m.role==="user"?"user":"bot",m.role==="assistant"?mdToHtml(m.content):esc(m.content));
  });
  document.getElementById("chatCtx").innerHTML=`${iconSvg('i-book-open')}&nbsp;Session restaurée :&nbsp;<strong>${s.matiere==="Mathématiques_1C"?"Mathématiques":s.matiere} · ${s.niveau}${s.serie?" "+s.serie:""}</strong>`;
  chatBody.scrollTop=chatBody.scrollHeight;
  // Ouvre le panneau IA, garde l'historique ouvert (style VS Code, multi-panneaux)
  if(!aiOpen) toggleAI();
}

function clearHistory(){
  if(!confirm("Effacer tout l'historique de tes conversations ?"))return;
  const store=getHistStore();
  delete store[getUserHistKey()];
  saveHistStore(store);
  renderHistoryPanel();
  updateRail();
}

/* ============================================================ DATA */
const NIVEAUX=[
  {cycle:"Lycée",lvl:"2nde",sub:"Classe de Seconde"},
  {cycle:"Lycée",lvl:"1ère",sub:"Bac 1er groupe"},
  {cycle:"Lycée",lvl:"Tle",sub:"Examen : BAC"}
];
const SERIES_INFO={A:"Littéraire",C:"Scientifique",D:"Sciences de la nature"};
const SERIES_PAR_NIVEAU={"2nde":["A","C"],"1ère":["A","C","D"],"Tle":["A","C","D"]};
const MAT_SERIE={
  "2nde":{
    A:["Français","Histoire","Géographie","Anglais","Mathématiques","SVT","Physique-Chimie"],
    C:["Mathématiques","Physique-Chimie","SVT","Français","Histoire","Géographie","Anglais"]
  },
  "1ère":{
    A:["Philosophie","Français","Histoire","Géographie","Anglais","Mathématiques"],
    C:["Philosophie","Mathématiques_1C","Physique-Chimie","SVT","Français","Histoire","Géographie","Anglais"],
    D:["Philosophie","SVT","Physique-Chimie","Mathématiques","Français","Histoire","Géographie","Anglais"]
  },
  "Tle":{
    A:["Philosophie","Français","Histoire","Géographie","Anglais","Mathématiques"],
    C:["Mathématiques","Physique-Chimie","SVT","Philosophie","Histoire","Géographie","Anglais"],
    D:["SVT","Physique-Chimie","Mathématiques","Philosophie","Histoire","Géographie","Anglais"]
  }
};

const COURS = {
  "SVT":[
    {t:"Leçon 8 — La diversité des comportements alimentaires",s:"Habitudes alimentaires et facteurs explicatifs en Côte d'Ivoire.",
      notions:[
        {h:"Définition : comportement alimentaire",p:"Le comportement alimentaire est l'ensemble des conduites d'un individu vis-à-vis de la consommation d'aliments. Il varie selon les régions, les cultures et les environnements."},
        {h:"Habitudes alimentaires par région",p:"Nord : kabato, bouillie de maïs/mil/fonio, sauce arachide. Sud : foutou manioc/banane, attiéké, sauce biécosseu. Centre : foutou d'igname, n'gbô. Est : foutou de taro, sauce tosrodum. Ouest : riz, loco soukouè, sauce tikriti."},
        {h:"Facteurs expliquant la diversité",p:"(1) Diversité sociologique : préjugés, tabous, croyances religieuses. (2) Diversité de la végétation : savane herbeuse au Nord, forêt dense au Sud. (3) Diversité des sols : sols ferrugineux au Nord, ferralitiques au Sud-Ouest. (4) Diversité des climats : soudanéen, baouléen, attiéen, de montagne."},
        {h:"Cultures vivrières selon les zones",p:"Nord : céréales (maïs, mil, sorgho), arachide. Sud : banane plantain, riz, manioc. Centre : igname. Est : igname, taro, banane plantain. Ouest : riz, manioc, palmier à huile."}
      ],
      exos:["Vrai ou Faux : L'attiéké à l'huile rouge est la principale nourriture des Adjoukrou.","Cite deux facteurs qui expliquent la diversité des comportements alimentaires en Côte d'Ivoire.","Établis une relation entre la végétation et les habitudes alimentaires des Sénoufo et des Agni.","Complète : Dans le Nord, les sols ……… sont propices à la culture du maïs, du mil et du sorgho."]},
    {t:"Leçon 9 — Les habitudes alimentaires et la santé de l'homme",s:"Maladies nutritionnelles : causes, mécanismes et prévention.",
      notions:[
        {h:"Le goitre endémique",p:"Causé par une carence en iode dans l'alimentation. Sans iode, la glande thyroïde grossit (hypertrophie) : c'est le goitre. Le manioc et d'autres aliments goitrogènes favorisent l'élimination de l'iode. Fréquent dans les régions montagneuses (Man)."},
        {h:"L'obésité",p:"Prise de poids excessive due à un excès d'aliments caloriques et à la sédentarité. Se mesure avec l'IMC = masse (kg) / taille² (m). IMC normal : 19–25 ; surpoids : 25–30 ; obésité : au-dessus de 30."},
        {h:"L'artériosclérose",p:"Excès de graisses animales (cholestérol LDL) → dépôts sur les parois artérielles (plaques d'athérome) → artères rigides et cassantes. Peut provoquer une thrombose ou une crise cardiaque."},
        {h:"Mécanisme de la plaque d'athérome",p:"Dépôt lipidique sur la paroi → obstruction partielle → flux sanguin réduit → risque de rupture de la plaque (thrombose). Prévention : alimentation variée, équilibrée, activité physique régulière."}
      ],
      exos:["Calcule l'IMC d'un élève de 68 kg mesurant 1,70 m. Déduis son état.","Explique le mécanisme d'apparition du goitre endémique.","Quelle est la différence entre obésité et artériosclérose ? Cite une cause commune.","Un patient a une artère coronaire partiellement obstruée. Nomme la maladie et propose un comportement alimentaire adapté."]}
  ],
  "Histoire":[
    {t:"Leçon 1 — L'histoire et la formation du citoyen",s:"Objet, fonctions de l'histoire et son rôle dans la construction citoyenne.",
      notions:[
        {h:"Définition de l'histoire",p:"Du grec «historia» (enquête). L'histoire est une discipline scientifique qui s'intéresse à la connaissance du passé des sociétés humaines et cherche à le reconstituer. Elle étudie guerres, modes de vie, activités économiques, religions du passé humain."},
        {h:"Fonctions de l'histoire",p:"(1) Point de repère : situer les faits dans le temps (ex : indépendance de la CI le 07 août 1960). (2) Outil de développement : «crée un capital spirituel» (Ki-Zerbo). (3) Arme idéologique : conscientiser les peuples, mais aussi risque de propagande (Paul Valéry)."},
        {h:"Histoire et transformation du citoyen",p:"Elle améliore l'héritage de génération en génération, renforce la cohésion sociale, développe l'esprit critique, la tolérance, la solidarité et la responsabilité citoyenne."},
        {h:"Sources de l'histoire",p:"Sources écrites, sources orales (griots, traditionnistes), sources archéologiques, linguistiques. Pour l'Afrique, la source orale a longtemps été la principale voie de transmission du passé."}
      ],
      exos:["Explique la phrase de Paul Valéry : «L'histoire engendre de faux souvenirs, entretient leurs vieilles plaies.»","L'étude de l'histoire aide-t-elle à fortifier le sens de la responsabilité citoyenne ? Justifie.","Cite deux sources utilisées par l'historien pour reconstituer le passé des peuples africains.","Parmi ces valeurs, entoure celles que l'histoire enseigne : racisme · tolérance · xénophobie · solidarité · patriotisme · violence."]}
  ],
  "Géographie":[
    {t:"Leçon 1 — La géographie : objet, intérêt et démarche",s:"Définition, domaines d'étude, démarche scientifique et intérêt de la géographie.",
      notions:[
        {h:"Définition et étymologie",p:"Du grec «geographia» (gê = terre, graphein = décrire). La géographie est la science de l'espace. Elle décrit et explique tous les phénomènes naturels et humains observés à la surface de la Terre. Objet d'étude : l'Homme dans son milieu de vie."},
        {h:"Les trois grands domaines",p:"(1) Géographie physique : climat, relief, végétation, sols, cours d'eau (géomorphologie, climatologie, hydrographie). (2) Géographie humaine : population, habitat, urbanisation (démographie, géographie rurale/urbaine). (3) Géographie économique : agriculture, industrie, commerce, transports."},
        {h:"La démarche géographique en 5 étapes",p:"Observation → Localisation → Description → Explication → Comparaison. Regroupées en deux phases : phase descriptive (obs. + local. + desc.) et phase analytique (explication + comparaison)."},
        {h:"Intérêts de la géographie",p:"Pratique : s'orienter, connaître les milieux, outil de développement, aide à la guerre. Éducatif : formation intellectuelle, ouverture sur le monde, solidarité, responsabilité environnementale. Socio-économique : métiers de l'aménagement, enseignement, recherche."}
      ],
      exos:["Classe ces branches dans la bonne catégorie : océanographie, démographie, industrie, géomorphologie, transports, géographie rurale.","Écris Vrai ou Faux : «La géographie donne des informations sur le passé de l'homme.»","Explique les deux grandes phases de la démarche géographique.","À partir du document : «La géographie brise l'isolement…» — identifie l'idée générale et deux intérêts cités."]}
  ],
  "Mathématiques":[
    {t:"Leçon 1 — Vecteurs et points du plan",s:"Définition, opérations, colinéarité, bases et repères du plan.",
      notions:[
        {h:"Définition d'un vecteur",p:"Le vecteur AB est déterminé par le couple (A ; B). Il a une direction (droite AB), un sens (de A vers B) et une longueur (norme ‖AB‖ = AB). Un vecteur a une infinité de représentants."},
        {h:"Norme et vecteur unitaire",p:"La norme ‖u‖ est la distance AB. ‖u‖ ≥ 0 ; ‖u‖ = 0 ssi u = 0⃗. Dans une base orthonormée, si u a les coordonnées (x ; y) alors ‖u‖ = √(x² + y²). Un vecteur unitaire a une norme égale à 1."},
        {h:"Combinaisons linéaires et colinéarité",p:"λu + μv est une combinaison linéaire de u et v. Deux vecteurs u et v sont colinéaires ssi leur déterminant det(u,v) = xy' − yx' = 0. La colinéarité permet de démontrer que des points sont alignés ou des droites parallèles."},
        {h:"Bases et repères du plan",p:"Tout couple (i, j) de vecteurs non colinéaires est une base de V. Un repère (O, i, j) est dit orthonormé si i ⊥ j et ‖i‖ = ‖j‖ = 1. Coordonnées du milieu de [AB] : ((xA+xB)/2 ; (yA+yB)/2). Centre de gravité G : ((xA+xB+xC)/3 ; (yA+yB+yC)/3)."}
      ],
      exos:["ABC est un triangle, D et E tels que AD⃗ = (1/3)AB⃗ et CE⃗ = −2CA⃗. Démontre que (BE) // (CD).","Justifie que les vecteurs u(2 ; 1) et v(3 ; 1,5) sont colinéaires en calculant leur déterminant.","Le plan est muni du repère (O, I, J). On donne A(2 ; 3), B(4 ; 1) et C(5 ; 4). Les points O, A et B sont-ils alignés ?","Soit A'(-3+3)/2 milieu de [BC]. Calcule les coordonnées du centre de gravité G du triangle A(2;-3), B(-3;2), C(3;2)."]},
    {t:"Leçon 2 — Ensemble des nombres réels",s:"Rationnels, irrationnels, valeur absolue, minorants, majorants.",
      notions:[
        {h:"Nombres rationnels et irrationnels",p:"Un nombre rationnel s'écrit sous la forme a/b (a ∈ Z, b ∈ Z*). Un nombre irrationnel ne peut pas s'écrire sous cette forme (ex : √2, √3, π). Ensemble des réels ℝ = rationnels ∪ irrationnels. On a ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ."},
        {h:"Valeur absolue",p:"|x| = x si x ≥ 0 ; |x| = −x si x < 0. C'est la distance à zéro. Propriétés : |x − y| = distance de x à y ; |x| ≤ r ⟺ −r ≤ x ≤ r ; |x + y| ≤ |x| + |y| (inégalité triangulaire)."},
        {h:"Minorants, majorants, min, max",p:"M est un majorant de E si ∀x ∈ E, x ≤ M. m est un minorant si ∀x ∈ E, x ≥ m. Le maximum est le plus grand élément de E (s'il appartient à E). Le minimum est le plus petit. ℝ, ℤ, ℚ ne sont ni majorés ni minorés."},
        {h:"Résolution avec valeur absolue",p:"|x − a| = r a pour solutions x = a − r et x = a + r. |x − a| ≤ r ⟺ a − r ≤ x ≤ a + r. Graphiquement : trouver les points M d'abscisse x tels que AM = r sur la droite graduée."}
      ],
      exos:["Démontre par l'absurde que √5 − 2 est irrationnel.","Résous dans ℝ l'inéquation |x + 2| ≤ 3. Donne l'ensemble solution.","Soit B = ]−2 ; 7]. Trouve trois minorants, précise le maximum et justifie que B n'a pas de minimum.","Deux élèves Ali et Yao habitent à 400 m l'un de l'autre. Ali ne peut s'éloigner de plus de 200 m, Yao de plus de 300 m. Détermine la portion de rue où ils peuvent se retrouver."]}
  ],
  "Philosophie":[
    {t:"Leçon 1 — La méthode de lecture de texte philosophique",s:"Quatre étapes : explication littérale, problématique, explication méthodique, critique.",
      notions:[
        {h:"Les quatre étapes de la méthode",p:"(1) Explication littérale : définir les mots et expressions difficiles/essentiels selon le contexte ; identifier les connecteurs logiques et leurs fonctions. (2) Problématique : remplir la grille de lecture (thème, problème, thèse, antithèse, intention, enjeu, structure logique). (3) Explication méthodique : clarifier les idées principales, secondaires, illustrations, concepts et allusions. (4) Critique : évaluer l'intérêt du texte de façon interne (cohérence) et externe (confrontation à d'autres auteurs)."},
        {h:"La grille de lecture — les 7 items",p:"Thème (de quoi parle le texte ?), Problème (quelle question l'auteur résout-il ?), Thèse (la réponse de l'auteur), Antithèse (position contraire), Intention (objectif immédiat de l'auteur), Enjeu (intérêt lointain du texte), Structure logique (articulations et idées principales de chaque mouvement)."},
        {h:"Mots difficiles / essentiels et connecteurs",p:"Un mot difficile exige un effort de compréhension. Un mot essentiel est indispensable à la compréhension. Les connecteurs logiques relient des idées et assurent la cohérence : 'car' (justification), 'donc' (conséquence), 'mais' (opposition), 'comme' (comparaison), 'si' (supposition), 'ne…que' (restriction)…"},
        {h:"Critique interne et critique externe",p:"Critique interne : examiner la cohérence du texte en lui-même et la congruence entre argumentation et intention. Critique externe : confronter la thèse de l'auteur à d'autres philosophes et au vécu quotidien."}
      ],
      exos:["Sur le texte d'Épictète : relève et définis 5 mots ou expressions difficiles/essentiels (ex : 'cachot', 'maximes', 'décence', 'beauté intérieure', 'disciple').","Identifie les fonctions de trois connecteurs logiques dans le texte de Descartes : 'et', 'ainsi que', 'or'.","Dégage la problématique complète (thème, problème, thèse, antithèse, intention, enjeu) du texte d'Épictète sur la tenue du philosophe.","Sur le texte de Pascal (roseau pensant) : dégage les éléments de la problématique et identifie la structure logique en deux mouvements."]},
    {t:"Leçon 2 — L'introduction du commentaire de texte philosophique",s:"Éléments constitutifs et construction cohérente de l'introduction.",
      notions:[
        {h:"Définition de l'introduction",p:"L'introduction du commentaire est la première partie du devoir où l'on présente le texte. Elle s'élabore à partir de certains éléments de la problématique : le thème, le problème, la thèse et éventuellement la structure logique."},
        {h:"Les quatre éléments de l'introduction",p:"(1) Le thème : de quoi parle le texte. (2) Le problème : la question que l'auteur résout. (3) La thèse : la réponse de l'auteur. (4) La structure logique (facultatif) : les grands mouvements du texte et leurs idées principales."},
        {h:"Comment agencer les éléments",p:"L'ordre classique : généralité (optionnelle) → thème → problème → thèse → structure logique. Cet ordre n'est pas rigide, mais doit rester cohérent. Exemple : 'Ce texte de X parle de [thème]. À la question [problème], l'auteur répond que [thèse].'"},
        {h:"Exemple rédigé (texte d'Épictète)",p:"«Ce texte d'Épictète extrait de Maximes et Pensées parle de la tenue du philosophe et de son disciple. À la question : le philosophe et son disciple doivent-ils négliger leur tenue ?, l'auteur répond qu'ils doivent prendre soin de leur corps et de leur âme. Ce texte s'articule autour de deux mouvements : de L1 à L7, la nécessité de la décence ; de L7 à L12, la primauté de la beauté intérieure sur la beauté du corps.»"}
      ],
      exos:["Parmi ces items, choisis ceux qui entrent dans l'introduction : problème · enjeu · intention · thèse · antithèse · structure logique · thème.","Rédige l'introduction du commentaire du texte d'Épictète en agençant correctement les éléments.","Rédige l'introduction du texte d'Alain (l'homme ne se forme jamais par l'expérience solitaire) en identifiant d'abord thème, problème et thèse.","Rédige l'introduction du texte de Hountondji sur la philosophie comme débat sans fin."]}
  ],
  "Mathématiques_1C":[
    {t:"Leçon 1 — Équations et inéquations du second degré dans ℝ",s:"Discriminant, résolution, signe d'un polynôme, équations bicarrées et irrationnelles.",
      notions:[
        {h:"Discriminant et zéros d'un polynôme",p:"P(x) = ax² + bx + c (a ≠ 0). Discriminant : Δ = b² − 4ac. Si Δ > 0 : deux zéros distincts x₁ = (−b−√Δ)/(2a) et x₂ = (−b+√Δ)/(2a). Si Δ = 0 : un zéro double x₀ = −b/(2a). Si Δ < 0 : pas de zéro."},
        {h:"Somme et produit des solutions",p:"Si x₁ et x₂ sont les solutions de ax² + bx + c = 0, alors : x₁ + x₂ = −b/a et x₁ × x₂ = c/a. Pour trouver deux nombres de somme S et produit P : vérifier S² − 4P ≥ 0, puis résoudre x² − Sx + P = 0."},
        {h:"Signe d'un polynôme du second degré",p:"Si Δ > 0 avec x₁ < x₂ : P(x) a le signe de 'a' hors de [x₁ ; x₂] et le signe de '−a' entre x₁ et x₂. Si Δ = 0 : P(x) a toujours le signe de 'a' (sauf en x₀ où P = 0). Si Δ < 0 : P(x) garde toujours le signe de 'a'."},
        {h:"Équations bicarrées et irrationnelles",p:"Bicarrée ax⁴ + bx² + c = 0 : poser X = x², résoudre en X, puis x² = X. Équation irrationnelle √P(x) = Q(x) : équivaut à Q(x) ≥ 0 ET P(x) = (Q(x))². Inéquation √P(x) < Q(x) : P(x) ≥ 0, Q(x) ≥ 0 et P(x) < (Q(x))²."}
      ],
      exos:["Résous dans ℝ l'équation −2x² + 5x + 3 = 0 par la méthode du discriminant.","L'équation x² + 5x + 4 = 0 admet −1 comme solution. Trouve l'autre solution sans recalculer Δ.","Résous dans ℝ l'inéquation 2x² − 5x + 3 < 0 (dresse le tableau de signe).","Résous dans ℝ l'équation bicarrée 2x⁴ − 3x² + 1 = 0.","Détermine deux entiers consécutifs dont la somme des carrés est 41."]},
    {t:"Leçon 2 — Barycentre",s:"Barycentre de 2, 3 ou 4 points pondérés, propriétés, coordonnées et lignes de niveau.",
      notions:[
        {h:"Barycentre de deux points pondérés",p:"Soient (A, a) et (B, b) avec a + b ≠ 0. Il existe un unique point G tel que aGA⃗ + bGB⃗ = 0⃗. On note G = bar{(A,a);(B,b)}. Conséquence : AG⃗ = b/(a+b) × AB⃗. Si a + b = 0 : pas de barycentre. Si a = b : G est le milieu de [AB] (isobarycentre)."},
        {h:"Réduction de somme et coordonnées",p:"Pour tout point M : aMA⃗ + bMB⃗ = (a+b)MG⃗. Coordonnées : G((axA + bxB)/(a+b) ; (ayA + byB)/(a+b)). Homogénéité : on peut multiplier tous les coefficients par un même réel k ≠ 0 sans changer le barycentre."},
        {h:"Barycentre de trois (ou quatre) points",p:"G = bar{(A,a);(B,b);(C,c)} si aGA⃗ + bGB⃗ + cGC⃗ = 0⃗ avec a+b+c ≠ 0. Barycentre partiel : on peut remplacer deux points pondérés par leur barycentre affecté de la somme de leurs coefficients."},
        {h:"Lignes de niveau",p:"Ligne de niveau k de f : ensemble des M tels que f(M) = k. Pour f(M) = MA² + MB² : ligne de niveau = cercle de centre G (isobarycentre de A et B). Pour f(M) = MA/MB : si k = 1, c'est la médiatrice de [AB] ; si k ≠ 1, c'est un cercle de centre G = bar{(A,1);(B,−k²)}."}
      ],
      exos:["Soient A(1;2) et B(−1;3). Calcule les coordonnées du barycentre G du système {(A,−1);(B,2)}.","ABC est un triangle. G = bar{(A,2);(B,5);(C,3)}. Construis G en utilisant le barycentre partiel H de (A,2) et (C,3).","Pour tout point M, exprime 3MA⃗ + 2MB⃗ en fonction de MG⃗ sachant que G = bar{(A,3);(B,2)}.","On donne AB = 12. Détermine la ligne de niveau 122 de f : M ↦ MA² + MB². C'est quoi comme figure ?"]}
  ],
  "Physique-Chimie":[
    {t:"Leçon 1 — L'élément chimique",s:"Définition, symboles, corps simples et corps composés.",
      notions:[
        {h:"Mise en évidence expérimentale",p:"Expérience 1 : 2 Cu + O₂ → 2 CuO (combustion du cuivre). Expérience 2 : 2 CuO + C → 2 Cu + CO₂ (réduction). Expérience 3 : Cu²⁺ + Fe → Cu + Fe²⁺ (déplacement). Le cuivre est commun à ces trois transformations."},
        {h:"Définition de l'élément chimique",p:"L'élément chimique est ce qui est commun à un corps simple et à tous ses composés. On dénombre 118 éléments dont 93 naturels. Le symbole commence toujours par une majuscule suivie éventuellement d'une minuscule (ex : Cu, Fe, Mg)."},
        {h:"Corps simple et corps composé",p:"Corps simple : constitué d'un seul élément (H₂, O₂, O₃, Ne…). Corps composé : constitué de plusieurs éléments (H₂O, NH₃, CH₄, CuO…). Une formule brute indique les éléments et le nombre d'atomes de chaque."},
        {h:"Symboles à connaître",p:"C (carbone), N (azote), O (oxygène), S (soufre), H (hydrogène), Ca (calcium). Symboles issus de noms anciens : Na (sodium/Natrium), K (potassium/Kalium), Fe (fer/Ferrum), Hg (mercure/Hydrargyrum), Au (or/Aurum), Cu (cuivre/Cuprum), Sn (étain/Stannum), W (tungstène/Wolfram), Pb (plomb/Plumbum)."}
      ],
      exos:["Cite les éléments chimiques communs aux espèces : C₈H₁₀N₄O₂, Al₂(SO₄)₃, NH₃, C₁₂H₂₂O₁₁.","La molécule de chlorophylle est C₅₅H₇₂N₄O₅Mg. Écris les noms de tous les éléments chimiques qu'elle contient.","Vrai ou Faux : Le sulfure de fer, l'oxyde de fer II et le métal fer ont en commun l'élément soufre.","On chauffe du saccharose : il se forme du charbon et de la vapeur d'eau. Déduis les éléments chimiques contenus dans le saccharose."]}
  ]
};

/* ============================================================ AUTH */
function switchAuthTab(tab){
  document.getElementById("tabLogin").classList.toggle("on",tab==="login");
  document.getElementById("tabRegister").classList.toggle("on",tab==="register");
  document.getElementById("panelLogin").style.display=tab==="login"?"":"none";
  document.getElementById("panelRegister").style.display=tab==="register"?"":"none";
}

document.getElementById("loginBtn").onclick=()=>{
  const id=document.getElementById("loginId").value.trim();
  const pwd=document.getElementById("loginPwd").value;
  const err=document.getElementById("loginErr");
  if(!id){err.textContent="Entre un identifiant.";err.style.display="block";return;}
  const users=getUsers();
  if(!users[id]){err.textContent="Identifiant introuvable. Crée un compte ?";err.style.display="block";return;}
  if(users[id].pwd!==pwd){err.textContent="Mot de passe incorrect.";err.style.display="block";return;}
  err.style.display="none";
  const u=users[id];
  saveSession({id,name:u.name});
  STATE.profil=u.name;STATE.profilIco="i-backpack";STATE.isGuest=false;
  go("niveau");
};

document.getElementById("regBtn").onclick=()=>doRegister();
function doRegister(){
  const name=document.getElementById("regName").value.trim();
  const id=document.getElementById("regId").value.trim();
  const pwd=document.getElementById("regPwd").value;
  const err=document.getElementById("regErr");
  const ok=document.getElementById("regOk");
  err.style.display="none";ok.style.display="none";
  if(!name||!id||!pwd){err.textContent="Remplis tous les champs.";err.style.display="block";return;}
  if(pwd.length<4){err.textContent="Mot de passe trop court (min 4 car.).";err.style.display="block";return;}
  const users=getUsers();
  if(users[id]){err.textContent="Cet identifiant existe déjà.";err.style.display="block";return;}
  users[id]={name,pwd};saveUsers(users);
  saveSession({id,name});
  STATE.profil=name;STATE.profilIco="i-backpack";STATE.isGuest=false;
  ok.innerHTML=iconSvg('i-check')+" Compte créé ! Redirection…";ok.style.display="block";
  setTimeout(()=>go("niveau"),800);
}

["loginId","loginPwd"].forEach(i=>document.getElementById(i).addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("loginBtn").click();}));
["regName","regId","regPwd"].forEach(i=>document.getElementById(i).addEventListener("keydown",e=>{if(e.key==="Enter")doRegister();}));

/* ============================================================ MODAL */
function openGuestModal(action){
  STATE.pendingAction=action||null;
  switchModalTab("register");
  document.getElementById("guestModal").classList.remove("hidden");
  setTimeout(()=>document.getElementById("mRegName").focus(),100);
}
function closeGuestModal(){document.getElementById("guestModal").classList.add("hidden");STATE.pendingAction=null;}
function switchModalTab(tab){
  document.getElementById("modalTabReg").classList.toggle("on",tab==="register");
  document.getElementById("modalTabLog").classList.toggle("on",tab==="login");
  document.getElementById("modalRegBody").style.display=tab==="register"?"":"none";
  document.getElementById("modalLogBody").style.display=tab==="login"?"":"none";
}
function doModalRegister(){
  const name=document.getElementById("mRegName").value.trim();
  const id=document.getElementById("mRegId").value.trim();
  const pwd=document.getElementById("mRegPwd").value;
  const err=document.getElementById("mRegErr");
  const ok=document.getElementById("mRegOk");
  err.style.display="none";ok.style.display="none";
  if(!name||!id||!pwd){err.textContent="Remplis tous les champs.";err.style.display="block";return;}
  if(pwd.length<4){err.textContent="Mot de passe trop court (min 4 car.).";err.style.display="block";return;}
  const users=getUsers();
  if(users[id]){err.textContent="Identifiant déjà utilisé.";err.style.display="block";return;}
  users[id]={name,pwd};saveUsers(users);
  saveSession({id,name});
  STATE.profil=name;STATE.profilIco="i-backpack";STATE.isGuest=false;
  ok.innerHTML=iconSvg('i-check')+" Compte créé ! Bienvenue, "+esc(name);
  ok.style.display="block";
  updateTopbarActions();updateRail();
  setTimeout(()=>{closeGuestModal();if(STATE.pendingAction)STATE.pendingAction();},900);
}
function doModalLogin(){
  const id=document.getElementById("mLogId").value.trim();
  const pwd=document.getElementById("mLogPwd").value;
  const err=document.getElementById("mLogErr");
  err.style.display="none";
  const users=getUsers();
  if(!users[id]||users[id].pwd!==pwd){err.textContent="Identifiant ou mot de passe incorrect.";err.style.display="block";return;}
  const u=users[id];
  saveSession({id,name:u.name});
  STATE.profil=u.name;STATE.profilIco="i-backpack";STATE.isGuest=false;
  updateTopbarActions();updateRail();
  closeGuestModal();
  if(STATE.pendingAction)STATE.pendingAction();
}
["mRegName","mRegId","mRegPwd"].forEach(i=>document.getElementById(i).addEventListener("keydown",e=>{if(e.key==="Enter")doModalRegister();}));
["mLogId","mLogPwd"].forEach(i=>document.getElementById(i).addEventListener("keydown",e=>{if(e.key==="Enter")doModalLogin();}));
document.getElementById("guestModal").addEventListener("click",function(e){if(e.target===this)closeGuestModal();});

/* ============================================================ ROUTING */
const views=["accueil","connexion","niveau","matiere","cours"];
function go(name){
  views.forEach(v=>document.getElementById("view-"+v).classList.toggle("active",v===name));
  window.scrollTo({top:0,behavior:"smooth"});
  if(name!=="cours") closeAllDrawers();
  updateTopbarActions();
  renderCrumbs();
  if(name==="niveau")renderNiveaux();
  if(name==="matiere")renderMatieres();
  if(name==="cours")renderCours();
  updateRail();
}

function renderCrumbs(){
  const c=document.getElementById("crumbs");
  let parts=[];
  if(STATE.niveau)parts.push(iconSvg('i-grad')+" "+STATE.niveau);
  if(STATE.serie)parts.push(iconSvg('i-divide')+" Série "+STATE.serie);
  if(STATE.matiere)parts.push(iconSvg(STATE.matiereIco||'i-book-open')+" "+(STATE.matiere==="Mathématiques_1C"?"Mathématiques":STATE.matiere));
  c.innerHTML=parts.map((p,i)=>`<span class="c">${p}</span>${i<parts.length-1?'<span class="sep">›</span>':''}`).join("");
}

function logout(){
  clearSession();
  Object.assign(STATE,{profil:"",niveau:"",serie:"",matiere:"",isGuest:false});
  closeAllDrawers();
  go("accueil");
}
function enterAsGuest(){
  STATE.profil="Invité";STATE.profilIco="i-search";STATE.isGuest=true;
  go("niveau");
}

/* ============================================================ NIVEAUX */
function renderNiveaux(){
  const g=document.getElementById("levelsGrid");g.innerHTML="";
  NIVEAUX.forEach(n=>{
    const el=document.createElement("div");el.className="lcard";
    el.innerHTML=`<div class="cycle">${n.cycle}</div><div class="lvl">${n.lvl}</div><div class="sub">${n.sub}</div>`;
    el.onclick=()=>{STATE.niveau=n.lvl;STATE.serie="";STATE.matiere="";go("matiere");};
    g.appendChild(el);
  });
}

/* ============================================================ MATIERES */
function chooseSerie(code){STATE.serie=code;renderMatieres();}
function matieresPourNiveau(){
  if(!SERIES_PAR_NIVEAU[STATE.niveau]||!STATE.serie)return null;
  return MAT_SERIE[STATE.niveau][STATE.serie]||[];
}
function renderMatieres(){
  const sel=document.getElementById("serieSelector"),g=document.getElementById("subjectsGrid");
  const dispo=SERIES_PAR_NIVEAU[STATE.niveau]||[];
  if(dispo.length){
    sel.style.display="block";
    sel.innerHTML=`<div style="font-size:.9rem;color:var(--ink-soft);margin-bottom:14px">Classe de ${STATE.niveau} — choisis ta série :</div>
      <div class="serie-grid">${dispo.map(c=>`<div class="scard ${STATE.serie===c?'on':''}" onclick="chooseSerie('${c}')"><div class="sc">${c}</div><div class="sl">${SERIES_INFO[c]||c}</div></div>`).join("")}</div>`;
  }else{sel.style.display="none";}
  const mats=matieresPourNiveau();
  if(!mats){
    document.getElementById("matiereSub").textContent=`Classe de ${STATE.niveau} — choisis ta série ci-dessus.`;
    g.innerHTML="";renderCrumbs();return;
  }
  document.getElementById("matiereSub").textContent=`${STATE.niveau} ${STATE.serie?`Série ${STATE.serie} · ${SERIES_INFO[STATE.serie]}`:""} — ${mats.length} matières.`;
  g.innerHTML="";
  mats.forEach(name=>{
    const m=MATIERES_DEF.find(x=>x.n===name);if(!m)return;
    const nb=(COURS[m.n]||[]).length;if(!nb)return;
    const displayName=m.n==="Mathématiques_1C"?"Mathématiques":m.n;
    const el=document.createElement("div");el.className="subj";el.style.setProperty("--c",m.c);
    el.innerHTML=`<span class="e">${iconSvg(m.e)}</span><h4>${displayName}</h4><span class="sd">${m.d}</span><div class="n">${nb} leçon${nb>1?"s":""} · cours + exercices</div>`;
    el.onclick=()=>{STATE.matiere=m.n;STATE.matiereIco=m.e;STATE.matColor=m.c;go("cours");};
    g.appendChild(el);
  });
  renderCrumbs();
}

/* ============================================================ COURS */
function switchTab(t){
  STATE.tab=t;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));
  renderChapters();
}
function renderCours(){
  const b=document.getElementById("matiereBanner");
  b.style.setProperty("--c",STATE.matColor||"var(--orange)");
  const serieTxt=STATE.serie?` Série ${STATE.serie}`:"";
  const displayMat=STATE.matiere==="Mathématiques_1C"?"Mathématiques":STATE.matiere;
  b.innerHTML=`<div class="big">${iconSvg(STATE.matiereIco||'i-book-open')}</div><div><h1>${displayMat}</h1><p>${STATE.profil} · ${STATE.niveau}${serieTxt} · ${(COURS[STATE.matiere]||[]).length} leçon(s)</p></div>`;
  STATE.tab="cours";
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x.dataset.tab==="cours"));
  renderChapters();
  initChat();
  renderHistoryPanel();
  updateTopbarActions();
  updateRail();
}
function renderChapters(){
  const zone=document.getElementById("chaptersZone");
  const list=COURS[STATE.matiere]||[];
  zone.innerHTML="";
  list.forEach((ch,i)=>{
    const card=document.createElement("div");card.className="chapter";
    let inner="";
    if(STATE.tab==="cours"){
      inner=`<div class="ch-section-title">${iconSvg('i-book-open')} Notions clés</div>`+
        ch.notions.map(no=>`<div class="notion"><div class="dot"></div><div class="nt">
          <strong>${no.h}</strong><p>${no.p}</p>
          <button class="ask-ia" onclick="guardedAskNotion('${esc(ch.t)}','${esc(no.h)}')">${iconSvg('i-bot')} Je ne comprends pas → demander à Akwaba</button>
        </div></div>`).join("");
    }else{
      inner=`<div class="ch-section-title">${iconSvg('i-pencil')} Exercices</div>`+
        ch.exos.map((ex,j)=>`<div class="exo"><div class="lbl">Exercice ${j+1}</div>${esc(ex)}
          <div><button class="ask-ia" onclick="guardedAskExo('${esc(ch.t)}',${j})">${iconSvg('i-bot')} M'aider à résoudre</button></div>
        </div>`).join("")+
        `<div class="gen-row"><button class="btn btn-green" style="padding:.55rem 1rem;font-size:.83rem;margin-top:4px" onclick="guardedGenExo(${i})">${iconSvg('i-wand')} Générer un exercice supplémentaire</button></div>
         <div class="ai-exo" id="aiexo-${i}"></div>`;
    }
    card.innerHTML=`<div class="ch-head" onclick="toggleCh(this)">
      <div class="ch-num">${i+1}</div>
      <div><h3>${ch.t}</h3><div class="ch-sub">${ch.s}</div></div>
      <div class="ch-chev">${iconSvg('i-chevron')}</div>
    </div><div class="ch-body">${inner}</div>`;
    zone.appendChild(card);
  });
  if(zone.firstChild)zone.firstChild.classList.add("open");
}
function toggleCh(head){head.parentElement.classList.toggle("open");}
function esc(s){return(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/'/g,"&#39;").replace(/"/g,"&quot;");}

/* ============================================================ AUTH GUARD */
function requireAuth(action){
  if(!STATE.isGuest||isLoggedIn()){action();return;}
  openGuestModal(action);
}
function guardedAskNotion(chapitre,notion){requireAuth(()=>askNotion(chapitre,notion));}
function guardedAskExo(chapitre,j){requireAuth(()=>askExo(chapitre,j));}
function guardedGenExo(i){requireAuth(()=>genExo(i));}
function guardedSendChat(text){requireAuth(()=>sendChat(text));}

/* ============================================================ APPEL IA (Groq via backend) */
async function callClaude(system,messages){
  // Si la page est ouverte en double-cliquant le fichier (file://),
  // le serveur n'est pas joignable → on l'explique clairement.
  if(location.protocol==="file:"){
    throw new Error("Ouvre la page via le serveur : lance « python app.py » puis va sur http://localhost:5000 (ne double-clique pas le fichier).");
  }
  // Sinon (page servie en http par Flask) on appelle toujours le backend Groq.
  const r=await fetch(CONFIG.backendUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system,messages,max_tokens:1000})});
  if(!r.ok){
    let msg="Erreur serveur ("+r.status+")";
    try{const d=await r.json();if(d.error)msg=d.error;}catch(_){}
    throw new Error(msg);
  }
  const d=await r.json();
  if(d.error)throw new Error(d.error);
  return d.text;
}

/* ============================================================ MARKDOWN */
function mdToHtml(t){
  t=t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  t=t.replace(/^#{1,3} (.*)$/gm,"<h4>$1</h4>");
  t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>");
  const lines=t.split("\n");let html="",ul=false,ol=false;
  for(let ln of lines){
    if(/^\s*[-•]\s+/.test(ln)){if(!ul){html+="<ul>";ul=true;}html+="<li>"+ln.replace(/^\s*[-•]\s+/,"")+"</li>";continue;}
    if(ul){html+="</ul>";ul=false;}
    if(/^\s*\d+[\.\)]\s+/.test(ln)){if(!ol){html+="<ol>";ol=true;}html+="<li>"+ln.replace(/^\s*\d+[\.\)]\s+/,"")+"</li>";continue;}
    if(ol){html+="</ol>";ol=false;}
    if(ln.trim()==="")continue;
    html+=/^<h4>/.test(ln)?ln:"<p>"+ln+"</p>";
  }
  if(ul)html+="</ul>";if(ol)html+="</ol>";
  return html;
}

/* ============================================================ CHAT */
const chatBodyEl=document.getElementById("chatBody");
const chatInput=document.getElementById("chatInput");
const chatSend=document.getElementById("chatSend");
let chatHistory=[];
let chatSaveTimer=null;

function scheduleSave(){
  clearTimeout(chatSaveTimer);
  chatSaveTimer=setTimeout(()=>{
    saveCurrentChatToHistory(STATE.matiere,STATE.niveau,STATE.serie,chatHistory);
  },3000);
}

function chatSystem(){
  const cls=STATE.niveau+(STATE.serie?` Série ${STATE.serie} (${SERIES_INFO[STATE.serie]||""})`:"");
  return `Tu es Akwaba, le professeur virtuel de «Mon École IA», plateforme éducative ivoirienne basée sur le programme du MENA.
Tu aides l'élève «${STATE.profil}» en classe de «${cls}» pour la matière «${STATE.matiere}».

RÔLE : expliquer les notions du cours et aider à résoudre les exercices étape par étape SANS donner directement la réponse finale (l'élève doit chercher).

MÉTHODE (adapte selon la question, ne sois pas rigide) :
- Explication claire, simple, au niveau de l'élève.
- Exemple concret du quotidien ivoirien (FCFA, Abidjan, marché, manioc, attiéké, fleuve Comoé…) quand c'est utile.
- Petite question ou indice pour faire réfléchir l'élève.
- De temps en temps : un «Le savais-tu ?» (culture générale liée au sujet).

RÈGLES :
- Réponds TOUJOURS en français, de façon bienveillante et encourageante.
- Décompose en étapes courtes. Pars de ce que l'élève connaît déjà.
- Maths/sciences : formules en texte lisible (x², √, a/b, ×, ÷) SANS LaTeX ni symboles complexes.
- Reste concis. Termine souvent par une petite question pour vérifier la compréhension.
- Si la question sort de la matière «${STATE.matiere}», rappelle gentiment à l'élève qu'il est en cours de ${STATE.matiere} et invite-le à changer de matière depuis le menu si besoin.
- Si l'élève a joint un ou plusieurs fichiers (photo d'exercice, document), base ton aide sur le nom/contenu décrit de ces fichiers.`;
}

function initChat(){
  chatHistory=[];
  chatBodyEl.innerHTML="";
  pendingFiles=[];
  renderPendingFiles();
  document.getElementById("chatCtx").innerHTML=`${iconSvg('i-book-open')}&nbsp;Contexte :&nbsp;<strong>${STATE.matiere==="Mathématiques_1C"?"Mathématiques":STATE.matiere} · ${STATE.niveau}${STATE.serie?" "+STATE.serie:""}</strong>`;
  const guestNotice=STATE.isGuest&&!isLoggedIn()?`<br><span style="font-size:.8rem;color:var(--ink-soft)">${iconSvg('i-bulb')} Clique sur «Demander à Akwaba» — une inscription rapide sera demandée.</span>`:"";
  const matDisplay=STATE.matiere==="Mathématiques_1C"?"Mathématiques":STATE.matiere;
  const welcomeMd=mdToHtml(`Bonjour ! Je suis **Akwaba**, ton tuteur IA. On travaille **${matDisplay}** (${STATE.niveau}${STATE.serie?" Série "+STATE.serie:""}). Pose ta question ici, ajoute une photo de ton exercice avec le bouton {{plus}}, ou parle directement avec le bouton {{mic}} !`)
    .replace("{{plus}}",iconSvg('i-plus')).replace("{{mic}}",iconSvg('i-mic'));
  addMsg("bot",welcomeMd+guestNotice);
  const sug=document.getElementById("chatSug");sug.innerHTML="";
  (COURS[STATE.matiere]||[]).slice(0,3).forEach(ch=>{
    const b=document.createElement("button");b.className="chip";
    b.textContent=ch.t.replace(/^Leçon \d+ — /,"");
    b.onclick=()=>guardedSendChat("Explique-moi simplement : "+ch.t.replace(/^Leçon \d+ — /,""));
    sug.appendChild(b);
  });
}

function addMsg(role,html,files){
  const m=document.createElement("div");m.className="msg "+(role==="user"?"user":"bot");
  let attachHtml="";
  if(files&&files.length){
    attachHtml=files.map(f=>`<div class="msg-attach">${iconSvg(fileIconFor(f.name))}<span>${esc(f.name)}</span></div>`).join("");
  }
  m.innerHTML=`<div class="av">${role==="user"?iconSvg('i-user'):iconSvg('i-bot')}</div><div class="bubble">${attachHtml}${html}</div>`;
  chatBodyEl.appendChild(m);chatBodyEl.scrollTop=chatBodyEl.scrollHeight;return m;
}
function showTyping(){const m=document.createElement("div");m.className="msg bot";m.id="tp";m.innerHTML=`<div class="av">${iconSvg('i-bot')}</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;chatBodyEl.appendChild(m);chatBodyEl.scrollTop=chatBodyEl.scrollHeight;}
function hideTyping(){const t=document.getElementById("tp");if(t)t.remove();}

async function sendChat(text){
  const hasFiles=pendingFiles.length>0;
  if((!text||!text.trim())&&!hasFiles)return;
  if(!aiOpen) toggleAI();
  const filesForMsg=pendingFiles.slice();
  let displayText=text&&text.trim()?text.replace(/</g,"&lt;"):(filesForMsg.length?"<em>(fichier joint, sans message)</em>":"");
  addMsg("user",displayText,filesForMsg);

  let contentForModel=text&&text.trim()?text:"";
  if(filesForMsg.length){
    const list=filesForMsg.map(f=>`«${f.name}»`).join(", ");
    contentForModel+= (contentForModel?"\n\n":"") + `[Fichier(s) joint(s) : ${list}]`;
  }
  chatHistory.push({role:"user",content:contentForModel});
  chatInput.value="";chatSend.disabled=true;showTyping();
  clearPendingFiles();
  try{
    const reply=await callClaude(chatSystem(),chatHistory);
    hideTyping();addMsg("bot",mdToHtml(reply));
    chatHistory.push({role:"assistant",content:reply});
    scheduleSave();
  }catch(e){
    hideTyping();addMsg("bot",iconSvg('i-alert')+" "+mdToHtml(e.message));
  }finally{chatSend.disabled=false;chatInput.focus();}
}

chatSend.onclick=()=>{requireAuth(()=>sendChat(chatInput.value));};
chatInput.addEventListener("keydown",e=>{if(e.key==="Enter")requireAuth(()=>sendChat(chatInput.value));});

function askNotion(chapitre,notion){
  if(!aiOpen) toggleAI();
  sendChat(`Dans la leçon «${chapitre}», je ne comprends pas la notion : «${notion}». Peux-tu me l'expliquer simplement avec un exemple concret ?`);
}
function askExo(chapitre,j){
  if(!aiOpen) toggleAI();
  const ch=(COURS[STATE.matiere]||[]).find(c=>c.t===chapitre);
  const ex=ch?ch.exos[j]:"";
  sendChat(`Aide-moi à résoudre cet exercice (${chapitre}), étape par étape SANS me donner directement la réponse : «${ex}»`);
}

/* ============================================================ PIÈCES JOINTES (bouton +) */
let pendingFiles=[]; // {name, size, type}
const fileInput=document.getElementById("fileInput");
const attachBtn=document.getElementById("attachBtn");

function fileIconFor(name){
  const ext=(name.split(".").pop()||"").toLowerCase();
  if(["png","jpg","jpeg","webp","gif"].includes(ext))return "i-image";
  if(["txt","md"].includes(ext))return "i-file-text";
  return "i-file";
}

attachBtn.onclick=()=>{
  requireAuth(()=>fileInput.click());
};
fileInput.addEventListener("change",()=>{
  const files=Array.from(fileInput.files||[]);
  files.forEach(f=>{
    if(pendingFiles.length>=4)return; // limite raisonnable
    pendingFiles.push({name:f.name,size:f.size,type:f.type});
  });
  fileInput.value="";
  renderPendingFiles();
  if(!aiOpen) toggleAI();
  chatInput.focus();
});

function renderPendingFiles(){
  const box=document.getElementById("pendingFiles");
  if(!pendingFiles.length){box.classList.remove("show");box.innerHTML="";return;}
  box.classList.add("show");
  box.innerHTML=pendingFiles.map((f,i)=>`<div class="pfile">${iconSvg(fileIconFor(f.name))}<span>${esc(f.name)}</span><button onclick="removePendingFile(${i})" aria-label="Retirer">${iconSvg('i-close')}</button></div>`).join("");
}
function removePendingFile(i){pendingFiles.splice(i,1);renderPendingFiles();}
function clearPendingFiles(){pendingFiles=[];renderPendingFiles();}

/* ============================================================ VOLET VOCAL (micro) */
const micBtn=document.getElementById("micBtn");
let recognizer=null, isRecording=false;

function getSpeechRecognition(){
  return window.SpeechRecognition||window.webkitSpeechRecognition||null;
}

function initVoice(){
  const SR=getSpeechRecognition();
  if(!SR){
    micBtn.title="Reconnaissance vocale non disponible sur ce navigateur";
    return;
  }
  recognizer=new SR();
  recognizer.lang="fr-FR";
  recognizer.continuous=false;
  recognizer.interimResults=true;

  recognizer.onresult=(e)=>{
    let finalText="",interim="";
    for(let i=0;i<e.results.length;i++){
      const r=e.results[i];
      if(r.isFinal)finalText+=r[0].transcript;
      else interim+=r[0].transcript;
    }
    chatInput.value=(finalText||interim).trim();
  };
  recognizer.onerror=()=>{stopRecording();};
  recognizer.onend=()=>{stopRecording();};
}

function startRecording(){
  if(!recognizer){micBtn.title="Reconnaissance vocale non disponible sur ce navigateur";return;}
  isRecording=true;
  micBtn.classList.add("recording");
  micBtn.querySelector(".ico use").setAttribute("href","#i-mic-off");
  try{recognizer.start();}catch(e){/* déjà démarré */}
}
function stopRecording(){
  isRecording=false;
  micBtn.classList.remove("recording");
  micBtn.querySelector(".ico use").setAttribute("href","#i-mic");
  try{recognizer&&recognizer.stop();}catch(e){}
}
micBtn.onclick=()=>{
  requireAuth(()=>{
    if(!recognizer)initVoice();
    if(!recognizer)return;
    if(isRecording)stopRecording();else startRecording();
    if(!aiOpen) toggleAI();
  });
};
initVoice();

/* ============================================================ GENERATE EXO */
async function genExo(i){
  const ch=(COURS[STATE.matiere]||[])[i];if(!ch)return;
  const box=document.getElementById("aiexo-"+i);
  box.style.display="block";
  box.innerHTML=`<div class="lbl">${iconSvg('i-sparkle')} Exercice généré par l'IA</div><span class="spin"></span> Génération…`;
  const sys=`Tu génères UN exercice supplémentaire pour des élèves de ${STATE.niveau}${STATE.serie?" Série "+STATE.serie:""} en ${STATE.matiere}, sur la leçon «${ch.t}».
Format : énoncé clair et court, niveau adapté, contextualisé au quotidien ivoirien si possible. Termine par «Indice : …». Pas de corrigé complet. Formules en texte sans LaTeX.`;
  try{
    const out=await callClaude(sys,[{role:"user",content:`Propose un nouvel exercice sur : ${ch.t}.`}]);
    box.innerHTML=`<div class="lbl">${iconSvg('i-sparkle')} Exercice généré par Akwaba</div>${mdToHtml(out)}<div style="margin-top:8px"><button class="ask-ia" onclick="guardedGenExo(${i})">${iconSvg('i-history')} En générer un autre</button></div>`;
  }catch(e){
    box.innerHTML=`<div class="lbl">${iconSvg('i-sparkle')} Exercice généré par l'IA</div>${iconSvg('i-alert')} Génération impossible. Lance \`python app.py\`. <em>(${esc(e.message)})</em>`;
  }
}

/* ============================================================ INIT */
(function init(){
  const session=getSession();
  if(session){STATE.profil=session.name;STATE.profilIco="i-backpack";STATE.isGuest=false;}
  updateTopbarActions();
  updateRail();
  renderCrumbs();
  if(location.protocol!=="file:")document.getElementById("modeBanner").style.display="none";
})();
