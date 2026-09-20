import { expect, it } from 'vitest';
import { documentBlocks, sourcePeriodMetrics, sourceTitle, taskResources } from '../../shared/api4/candidate-content';
import type { Demo } from '../../shared/api4-types';
const source = `# Source\n| Period | Channel | Sessions | Completed orders |\n| --- | --- | --- | --- |\n| Previous | Paid | 1,500 | 60 |\n| Previous | Organic | 2,500 | 140 |\n| Current | Paid | 2,400 | 72 |\n| Current | Organic | 2,600 | 153 |\n\n## Limitations\nNot proof of causality.`;
it('derives personal metrics from source counts, never from task totals',()=>{
 expect(sourcePeriodMetrics(source)).toEqual([{label:'Sessions',before:'4,000',after:'5,000'},{label:'Completed orders',before:'200',after:'225'},{label:'Overall conversion',before:'5.0%',after:'4.5%'}]);
});
it.each(['plain text',source.replace('1,500','-1'),source.replace('1,500','15x'),source.replace('60','1,501'),source.replace('Current','Other')])('does not invent metrics from incompatible material %s',text=>{
 expect(sourcePeriodMetrics(text)).toEqual([]);
});
it('rejects duplicate grains and zero denominators',()=>{
 expect(sourcePeriodMetrics(source.replace('| Current | Organic | 2,600 | 153 |','| Current | Paid | 2,600 | 153 |'))).toEqual([]);
 expect(sourcePeriodMetrics(source.replaceAll('Previous','Current'))).toEqual([]);
});
it('keeps original text intact, renders HTML as text, and names sources only for display',()=>{
 const text='<script>do-not-run()</script>';expect(documentBlocks(text)[0].text).toBe(text);
 expect(documentBlocks(source).find(b=>b.type==='table')?.rows).toHaveLength(4);
 expect(sourceTitle('channel_analysis.md')).toBe('Channel conversion report');expect(sourceTitle('unknown_report.md')).toBe('unknown report');
});
it('only exposes resources selected by the actual task target',()=>{
 const data={task:{targetRequirementId:'sql'},taskTemplates:{sql:{resourceIds:['orders.csv']}},dataset:{resources:[{id:'orders.csv'},{id:'business_context.md'}]}} as unknown as Demo;
 expect(taskResources(data)).toEqual([{id:'orders.csv'}]);expect(taskResources({...data,task:{...data.task,targetRequirementId:null}})).toEqual([]);
});
