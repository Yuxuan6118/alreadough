import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const palette = { paper: "#f4efea", panel: "#fffaf7", ink: "#2b2726", accent: "#a65f6b", dough: "#efe2ce", line: "#d7c9c1" };
const fade = (frame: number, start: number, end: number) => interpolate(frame, [start, start + 14, end - 14, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

function Dust({ frame }: { frame: number }) {
  return <>{Array.from({ length: 28 }, (_, index) => {
    const x = 70 + ((index * 83) % 930);
    const y = ((frame * (1.2 + index % 4 * .22) + index * 137) % 1280) - 160;
    return <div key={index} style={{ position:"absolute", left:x, top:y, width:4 + index % 5, height:4 + index % 5, borderRadius:"50%", background:"#bfae9d", opacity:Math.max(0,Math.min(.45,(frame-index)/60)) }}/>;
  })}</>;
}

function DoughCharacter({ frame }: { frame: number }) {
  const { fps } = useVideoConfig();
  const settle = spring({ frame:frame-145, fps, config:{ damping:11, stiffness:92, mass:.8 } });
  const breathe = 1 + Math.sin(frame/18)*.018;
  return <div style={{ position:"absolute", left:"50%", top:660, width:410, height:390, transform:`translateX(-50%) scale(${interpolate(settle,[0,.55,1],[1.8,.78,1])*breathe},${interpolate(settle,[0,.55,1],[.4,1.16,1])/breathe})`, borderRadius:"46% 54% 48% 52% / 52% 47% 53% 48%", background:`radial-gradient(circle at 35% 26%,${palette.panel},${palette.dough} 58%,#dbc6aa)`, boxShadow:"inset 20px 24px 48px #fff9,inset -22px -28px 48px #a68a6430,0 45px 80px #5b453024" }}>
    <div style={{position:"absolute",left:122,top:153,width:18,height:22,borderRadius:"50%",background:"#5a4438"}}/><div style={{position:"absolute",right:122,top:153,width:18,height:22,borderRadius:"50%",background:"#5a4438"}}/><div style={{position:"absolute",left:"50%",top:204,width:30,height:7,borderRadius:99,background:"#72584b",transform:"translateX(-50%) rotate(-3deg)"}}/><div style={{position:"absolute",left:67,bottom:62,width:276,height:54,borderRadius:"50%",borderBottom:"4px solid #c9ad8e88",opacity:.66}}/>
  </div>;
}

export function AlreaDoughPromo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const merge = spring({ frame:frame-30, fps, config:{ damping:13, stiffness:70 } });
  const stretch = interpolate(frame,[78,122,152],[0,1,0],{ easing:Easing.inOut(Easing.cubic),extrapolateLeft:"clamp",extrapolateRight:"clamp" });
  const characterOpacity = interpolate(frame,[136,157],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const statementOpacity = fade(frame,205,338);
  const closeOpacity = interpolate(frame,[330,360],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const closeRise = interpolate(frame,[330,385],[50,0],{easing:Easing.out(Easing.cubic),extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <AbsoluteFill style={{overflow:"hidden",background:palette.paper,color:palette.ink,fontFamily:'"Helvetica Neue","PingFang SC",sans-serif'}}>
    <AbsoluteFill style={{background:"radial-gradient(circle at 18% 15%,#fff8,transparent 35%),radial-gradient(circle at 82% 74%,#e8d7d766,transparent 36%)"}}/><Dust frame={frame}/>
    <div style={{opacity:fade(frame,0,102)}}><div style={{position:"absolute",left:92,top:142,fontSize:24,letterSpacing:7,color:"#7d6f69"}}>面粉 + 水</div><div style={{position:"absolute",left:92,top:205,width:110,height:3,background:palette.accent}}/><div style={{position:"absolute",left:130+merge*235,top:665,width:310,height:310,borderRadius:"48%",background:palette.dough,boxShadow:"inset 20px 20px 38px #fff9,0 35px 60px #55422f1c",transform:`scale(${1+merge*.08},${1-merge*.08})`}}/><div style={{position:"absolute",right:145+merge*215,top:525,width:165,height:235,borderRadius:"55% 45% 60% 40%",background:"linear-gradient(165deg,#cddde2,#95b8c4)",clipPath:"polygon(50% 0,100% 72%,80% 100%,20% 100%,0 72%)",transform:`translateY(${merge*165}px) scale(${1-merge*.25})`,opacity:1-merge*.55}}/></div>
    <div style={{opacity:interpolate(frame,[72,90,150,166],[0,1,1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>{[-150,-100,-50,0,50,100,150].map((offset,index)=><div key={offset} style={{position:"absolute",left:540,top:820+offset,width:410+stretch*(270+index*34),height:20+index%3*6,borderRadius:99,background:index%2?"#ead8bf":"#f2e6d4",transform:`translateX(-50%) rotate(${offset/33}deg) scaleX(${.55+stretch*.9})`,transformOrigin:"center",boxShadow:"0 8px 18px #775f4230"}}/>)}</div>
    <div style={{opacity:characterOpacity}}><DoughCharacter frame={frame}/></div>
    <div style={{position:"absolute",inset:"1100px 84px auto",textAlign:"center",opacity:statementOpacity,transform:`translateY(${interpolate(frame,[205,245],[35,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}px)`}}><div style={{fontFamily:'Georgia,"Songti SC",serif',fontSize:78,lineHeight:1.3,letterSpacing:-3}}>不是等待发生</div><div style={{fontFamily:'Georgia,"Songti SC",serif',fontSize:78,lineHeight:1.3,letterSpacing:-3,color:palette.accent}}>而是回到已经拥有</div><div style={{width:1,height:105,background:palette.line,margin:"48px auto 36px"}}/><div style={{fontSize:28,lineHeight:1.8,letterSpacing:2,color:"#71635e"}}>一个愿望 · 深度陪伴 · 每天醒发</div></div>
    <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",alignContent:"center",gap:34,opacity:closeOpacity,transform:`translateY(${closeRise}px)`,background:`linear-gradient(180deg,${palette.paper}ee,${palette.paper})`}}><div style={{width:210,height:190,borderRadius:"46% 54% 48% 52%",background:`radial-gradient(circle at 35% 24%,${palette.panel},${palette.dough} 62%,#dbc6aa)`,boxShadow:"inset 12px 15px 22px #fff9,0 28px 55px #513b3520",position:"relative"}}><i style={{position:"absolute",left:65,top:74,width:10,height:13,borderRadius:99,background:"#584339"}}/><i style={{position:"absolute",right:65,top:74,width:10,height:13,borderRadius:99,background:"#584339"}}/><i style={{position:"absolute",left:94,top:105,width:22,height:4,borderRadius:99,background:"#72584b"}}/></div><div style={{fontFamily:'Georgia,"Songti SC",serif',fontSize:96,letterSpacing:-4}}>Alrea<span style={{color:palette.accent}}>Dough</span></div><div style={{fontSize:28,letterSpacing:5,color:"#776963"}}>已经属于你的生活</div></div>
  </AbsoluteFill>;
}
