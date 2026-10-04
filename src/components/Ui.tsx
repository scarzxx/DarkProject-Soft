import { CircleDot, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export function Panel({ title, icon: Icon = CircleDot, action, className = "", children }: { title: string; icon?: LucideIcon; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`panel ${className}`}><header className="panel-head"><div><Icon size={18}/><strong>{title}</strong></div>{action}</header><div className="panel-body">{children}</div></section>;
}
export function Slider({ label, value, min=0, max=100, step=1, suffix="%", onChange }: { label:string; value:number; min?:number; max?:number; step?:number; suffix?:string; onChange:(n:number)=>void }) {
  const progress=((value-min)/(max-min||1))*100;
  return <label className="slider"><span><b>{label}</b><em>{value}{suffix}</em></span><input type="range" min={min} max={max} step={step} value={value} style={{"--progress":`${progress}%`} as CSSProperties} onChange={e=>onChange(+e.target.value)}/></label>;
}
export function Toggle({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) { return <button className={`toggle ${value?"on":""}`} onClick={()=>onChange(!value)}><i/></button>; }
