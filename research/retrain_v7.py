#!/usr/bin/env python3
"""Reconstruct BTC SPOT 20:00 as-of features and train the actual structure-first v1.2.13 selector.

This script does not claim to retrain Pionex PERP; history is Binance SPOT.
Only data available at 20:00 TPE are consumed as predictors.
Never uses future candle in selection or training features.
"""
import json, zipfile, csv, datetime as dt, sys
from pathlib import Path
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score, log_loss

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
SOURCE=HERE / 'BTC_9Y_15M_原始資料.zip'
if not SOURCE.exists():
    SOURCE=Path('/mnt/data/BTC4H_果蠅式自動找規律_v6/BTC_9Y_15M_原始資料.zip')
DAY=86400000; H4=14400000; M15=900000
print('source',SOURCE,flush=True)
with zipfile.ZipFile(SOURCE) as z: raw=json.loads(z.read('k15.json'))
a=pd.DataFrame(raw,columns=['ts','open','high','low','close'])
a['ts']=a.ts.astype('int64')
a=a.drop_duplicates('ts',keep='last').sort_values('ts')
# grouped 4H candles: gaps rejected; 15m timestamps are opens UTC.
a['bucket']=a.ts//H4*H4
b=a.groupby('bucket',sort=True).agg(ts=('ts','min'),num=('ts','size'),last=('ts','max'),open=('open','first'),high=('high','max'),low=('low','min'),close=('close','last'))
b=b[(b['num']==16)&(b.ts==b.index)&(b['last']==b.index+15*M15)].reset_index(drop=True)
B=b.to_dict('records')
print('complete 4H',len(B),flush=True)
# first attempt exact scan definition of src/structure.js
E=[]
for i in range(len(B)-1):
    s=B[i]; t=B[i+1]
    if t['ts']!=s['ts']+H4: continue
    top=(s['close']>s['open'] and t['close']<t['open'] and abs(t['open']-s['close'])<=abs(s['close'])*.00015)
    floor=(s['close']<s['open'] and t['close']>t['open'] and abs(t['open']-s['close'])<=abs(s['close'])*.00015)
    if not(top or floor): continue
    for j in range(i+1,min(i+4,len(B))):
        v=B[j]
        if v['ts']!=s['ts']+(j-i)*H4:break
        if (top and v['close']<s['low']) or (floor and v['close']>s['high']):
            E.append({'kind':'頂齊' if top else '底齊','level':s['close'],'formed':s['ts'],'confirmed':v['ts']+H4,'id':f"{s['ts']}-{'T' if top else 'F'}"})
            break
print('aligned events',len(E),flush=True)
# daily known full bars, and 20:00 (12:00 UTC) partial from first 48 complete 15M of today
# Guard days with missing 15m, for safety.
a['day']=a.ts//DAY*DAY
full=a.groupby('day',sort=True).agg(first=('ts','min'),last=('ts','max'),n=('ts','size'),open=('open','first'),high=('high','max'),low=('low','min'),close=('close','last'))
full=full[(full.n==96)&(full['first']==full.index)&(full['last']==full.index+95*M15)]
partials=a[a.ts%DAY<12*3600000].groupby('day',sort=True).agg(first=('ts','min'),last=('ts','max'),n=('ts','size'),open=('open','first'),high=('high','max'),low=('low','min'),close=('close','last'))
partials=partials[(partials.n==48)&(partials['first']==partials.index)&(partials['last']==partials.index+47*M15)]
# For each current day recompute as-of HA with full previous days. same as market.js, but approx warmup=35
# SState slope is 5-bar regression on trailing SMA20 midline, vs previous 5.
def pct_slope(vals):
    vals=np.asarray(vals,float)
    mean=float(vals.mean())
    return 0.0 if abs(mean)<1e-12 else float(np.dot(np.arange(len(vals))-(len(vals)-1)/2,vals-mean)/np.sum((np.arange(len(vals))-(len(vals)-1)/2)**2)/abs(mean)*100)

# per full bar HA recursion and cached midline; only look at past yesterday
D=full.sort_index().copy(); days=D.index.to_numpy(dtype='int64');
ha_prev={};ha_complete={};hopen=0;hclose=0
for i,(day,r) in enumerate(D.iterrows()):
    ha_prev[day]=(hopen,hclose)  # from previous complete day
    c=(r['open']+r['high']+r['low']+r['close'])/4
    o=(hopen+hclose)/2 if i else (r['open']+r['close'])/2
    hopen=o;hclose=c
    ha_complete[day]=(hopen,hclose)
# Instead reconstruct HA using prior up to selected day; prior HA from current D series includes later only if same index, no future leaks.
def get_signal(day):
    if day not in partials.index: return None
    prev=D[D.index<day].tail(40)
    if len(prev)<35:return None
    # require last 35 calendar days complete (like live input) to avoid gap-induced HA distortions
    if prev.index[-1]!=day-DAY or (np.diff(prev.index[-35:])!=DAY).any():return None
    today=partials.loc[day]
    closes=np.r_[prev['close'].to_numpy(dtype=float),today['close']]
    mids=np.array([closes[i-19:i+1].mean() for i in range(19,len(closes))],float)
    recent=pct_slope(mids[-5:]);prior=pct_slope(mids[-10:-5]); improvement=recent-prior
    hc=(today['open']+today['high']+today['low']+today['close'])/4
    # Exact cumulative HA from previous complete days; no future values.
    latest_prev_day=int(prev.index[-1])
    po,pc=ha_complete[latest_prev_day]
    ho=(po+pc)/2
    slope_state=('rising' if recent>=.12 else 'flat' if recent>-.25 else 'flattening' if recent>=-.65 and improvement>=.12 else 'falling')
    haYellow=int(hc>=ho)
    above=bool(hc>=mids[-1]);kind='頂齊' if above else '底齊'
    return dict(kind=kind,slope_pct=recent,slope_change=improvement,ha_yellow=haYellow,regime_rising=int(slope_state=='rising'),regime_flattening=int(slope_state=='flattening'),regime_falling=int(slope_state=='falling'),mid_distance_pct=float((hc/mids[-1]-1)*100),side='中軌之上' if above else '中軌之下')

# Rebuild for all dates from 2017-10 onward. loop 2500*1500 HA recomputations okay (<10 secs)
byts={int(q['ts']):i for i,q in enumerate(B)}
features=[]
for k,(day,row) in enumerate(partials.iterrows()):
    day=int(day);asof=day+12*3600000
    if asof not in byts:continue
    i=byts[asof] # the forming 20-00 candle, all previous rows are complete
    if i<240:continue
    sig=get_signal(day)
    if not sig:continue
    price=float(row['close'])
    # price = 19:45-20:00 close; first 4H after decision starts 12Z
    prior=B[i-15:i]
    if len(prior)!=15 or any(prior[j]['ts']-prior[j-1]['ts']!=H4 for j in range(1,len(prior))):continue
    tr=[]
    for idx in range(i-14,i):
        candle=B[idx];last=B[idx-1]
        tr.append(max(candle['high']-candle['low'],abs(candle['high']-last['close']),abs(candle['low']-last['close'])))
    atr=float(np.mean(tr))
    if atr<=0:continue
    target=[e for e in E if e['kind']==sig['kind'] and e['confirmed']<=asof and e['confirmed']>0 and asof-e['confirmed']<=365*DAY and (e['level']-price)*(1 if sig['kind']=='頂齊' else -1)>0]
    if not target:continue
    sel=None;tier=None
    for window in [50,150,450,float('inf')]:
        group=[e for e in target if np.isinf(window) or asof-e['formed']<=window*H4]
        if group:
            sel=min(group,key=lambda e:((e['level'] if sig['kind']=='頂齊' else -e['level']),-e['confirmed']))
            tier=window;break
    if sel is None:continue
    distance=abs(sel['level']-price)/atr
    # To avoid unvalidated extrapolation of long-distance barriers, train up to 3 ATR.
    if not (0<distance<=3):continue
    # 20:00 -> 00:00 UTC times 12:00-16:00
    future=B[i];
    y=int(future['close'] > sel['level']*1.0001) if sig['kind']=='頂齊' else int(future['close']<sel['level']*.9999)
    features.append(dict(date=str(dt.datetime.fromtimestamp(day/1000,dt.UTC).date()),asof=asof,price=price,level=sel['level'],atr=atr,distance_atr=distance,tier=tier,level_formed=sel['formed'],level_confirmed=sel['confirmed'],target=y,close_0000=future['close'],**sig))
rows=pd.DataFrame(features)
print('all forecast training rows:',len(rows),flush=True)
# Expose explicit independent slope+HA effects in the deployed model, separate breakout directions.
fields=['distance_atr','slope_pct','slope_change','regime_rising','regime_flattening','regime_falling','ha_yellow','mid_distance_pct']
basefields=['distance_atr']
metrics=[];model_out={'version':'v7.0-structure-first-regime','trained_data':'Binance BTCUSDT SPOT 15m ->4H','trained_until':'2022-12-31','validation':'2023','posthoc_check':'2024-2026 previously inspected; not untouched blind holdout','selector':'structure-first-v1 [50,150,450,infinity]','input_features':fields,'models':{}}
for kind in ['頂齊','底齊']:
    d=rows[rows.kind==kind]
    years=pd.to_datetime(d.date).dt.year
    train=d[years<=2022].copy();val=d[years==2023].copy();hold=d[years>=2024].copy()
    if len(train)<80:raise RuntimeError(f'not enough {kind} train rows: {len(train)}')
    def fit(fs):
        x=train[fs].to_numpy(float)
        mu=x.mean(axis=0);std=x.std(axis=0);std[std<1e-9]=1
        reg=LogisticRegression(C=1.,max_iter=2000,random_state=42)
        reg.fit((x-mu)/std,train.target.to_numpy())
        return reg,mu,std
    def evaluate(fit,fs,ds):
        reg,mu,std=fit; prob=reg.predict_proba((ds[fs].to_numpy(float)-mu)/std)[:,1]
        return {'n':int(len(ds)),'positive':int(ds.target.sum()),'event_rate':float(ds.target.mean()),'brier':float(brier_score_loss(ds.target,prob)),'auc':float(roc_auc_score(ds.target,prob)) if ds.target.nunique()>1 else None}
    bmodel=fit(basefields); emodel=fit(fields)
    for typ,model,fs in [('distance',bmodel,basefields),('distance+SState_regime',emodel,fields)]:
        for period,ds in [('train_2017_2022',train),('val_2023',val),('check_2024_2026',hold)]:
            if len(ds)<2:continue
            metrics.append(dict(kind=kind,model=typ,period=period,**evaluate(model,fs,ds)))
    reg,mu,std=emodel
    model_out['models'][kind]={'features':fields,'mean':[float(x) for x in mu],'scale':[float(x) for x in std], 'coefs':[float(x) for x in reg.coef_[0]],'intercept':float(reg.intercept_[0]),'training_n':int(len(train)), 'training_event_rate':float(train.target.mean())}
    print('KIND',kind,'trained n',len(train),'coeff',dict(zip(fields,np.round(reg.coef_[0],3))),flush=True)
model_out['rows']=dict(total=len(rows),train=int((pd.to_datetime(rows.date).dt.year<=2022).sum()),val=int((pd.to_datetime(rows.date).dt.year==2023).sum()),check=int((pd.to_datetime(rows.date).dt.year>=2024).sum()))
ROOT.joinpath('model/regime_v7.json').write_text(json.dumps(model_out,ensure_ascii=False,indent=2))
rows.to_csv(HERE/'structure_first_v7_samples.csv',index=False)
pd.DataFrame(metrics).to_csv(HERE/'structure_first_v7_metrics.csv',index=False)
print(pd.DataFrame(metrics).to_string(index=False),flush=True)
