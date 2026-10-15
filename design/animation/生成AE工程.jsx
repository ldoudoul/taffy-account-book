(function(){
 var out=File($.fileName).parent.fsName.replace(/\\/g,'/')+'/';
 try {
 if(!app.project)app.newProject();
 if(app.project.numItems>0)throw new Error('Current project is not empty; preserved without modification.');
 app.beginUndoGroup('Taffy six anchored interactions');
 var originals=app.project.importFile(new ImportOptions(new File(out+'素材/taffy-expressions.png')));
 var actions=app.project.importFile(new ImportOptions(new File(out+'素材/taffy-actions.png')));
 var rects={base:[282,524,457,490],coin:[54,8,488,503],paw:[551,8,488,503],abacus:[1048,8,488,503],book:[40,516,489,499],caliper:[550,516,489,499],calculator:[1045,516,487,499]};
 function portrait(name){var r=rects[name];var c=app.project.items.addComp('素材裁切_'+name,r[2],r[3],1,2.6,30);var l=c.layers.add(name==='base'?originals:actions);l.anchorPoint.setValue([0,0]);l.position.setValue([-r[0],-r[1]]);return c;}
 var base=portrait('base');
 var names=['coin','paw','abacus','book','caliper','calculator'];
 var labels=['金币_抱金币眼睛发光','猫爪_猫耳轻摆','算盘_拨珠','账本_翻页','卡尺_量一量','计算器_轻按'];
 function ease(p){for(var k=1;k<=p.numKeys;k++){p.setTemporalEaseAtKey(k,[new KeyframeEase(0,65)],[new KeyframeEase(0,65)]);}}
 for(var i=0;i<names.length;i++){
 var name=names[i],r=rects[name],comp=app.project.items.addComp(labels[i],360,360,1,2.6,30);
 var b=comp.layers.add(base);b.anchorPoint.setValue([457/2,490]);b.position.setValue([180,360]);b.scale.setValue([360/490*100,360/490*100]);
 var l=comp.layers.add(portrait(name));l.anchorPoint.setValue([r[2]/2,r[3]]);l.position.setValue([180,360]);l.scale.setValue([360/r[3]*100,360/r[3]*100]);
 var op=l.opacity;op.setValueAtTime(0,0);op.setValueAtTime(.35,100);op.setValueAtTime(2.2,100);op.setValueAtTime(2.55,0);ease(op);
 var bop=b.opacity;bop.setValueAtTime(0,100);bop.setValueAtTime(.35,0);bop.setValueAtTime(2.2,0);bop.setValueAtTime(2.55,100);ease(bop);
 var pin=l.property('ADBE Effect Parade').addProperty('ADBE Corner Pin');
 var angle=name==='paw'?1.8:.8;var dx=Math.tan(angle*Math.PI/180)*r[3];
 var times=[0,.50,.88,1.23,1.61,2.2];var shifts=[0,-dx,dx,-dx*.7,dx*.5,0];
 for(var j=0;j<times.length;j++){pin.property(1).setValueAtTime(times[j],[shifts[j],0]);pin.property(2).setValueAtTime(times[j],[r[2]+shifts[j],0]);}
 pin.property(3).setValue([0,r[3]]);pin.property(4).setValue([r[2],r[3]]);ease(pin.property(1));ease(pin.property(2));
 comp.comment='2.2秒动作+350ms切换；腰线固定在Y=360。网页端使用同源透明素材及可中断合成动画。';
 try{comp.saveFrameToPng(1.0,new File(out+name+'-预览.png'));}catch(ignore){}
 }
 app.project.save(new File(out+'taffy-六种底部固定互动.aep'));
 app.endUndoGroup();

 }catch(e){alert('Taffy project: '+e.toString());}
})();

