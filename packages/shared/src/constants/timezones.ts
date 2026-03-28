/**
 * Curated list of UTC timezone offsets with representative city labels.
 * Stored value is a UTC offset string (e.g. "+2", "-5", "+5:30").
 * Label format: "(+offset) Region/City"
 */
export interface Timezone {
  value: string;
  label: string;
}

export const TIMEZONES: Timezone[] = [
  { value: '-12', label: '(-12) Baker Island' },
  { value: '-11', label: '(-11) Pago Pago/Samoa' },
  { value: '-10', label: '(-10) Honolulu/Hawaii' },
  { value: '-9:30', label: '(-9:30) Marquesas Islands' },
  { value: '-9', label: '(-9) Anchorage/Alaska' },
  { value: '-8', label: '(-8) Los Angeles/Vancouver' },
  { value: '-7', label: '(-7) Denver/Phoenix' },
  { value: '-6', label: '(-6) Chicago/Mexico City' },
  { value: '-5', label: '(-5) New York/Lima' },
  { value: '-4', label: '(-4) Halifax/Caracas' },
  { value: '-3', label: '(-3) São Paulo/Buenos Aires' },
  { value: '-2', label: '(-2) Fernando de Noronha' },
  { value: '-1', label: '(-1) Azores/Cape Verde' },
  { value: '+0', label: '(+0) London/Accra/Reykjavik' },
  { value: '+1', label: '(+1) Paris/Berlin/Madrid' },
  { value: '+2', label: '(+2) Bucharest/Chișinău/Cairo' },
  { value: '+3', label: '(+3) Moscow/Nairobi/Riyadh' },
  { value: '+3:30', label: '(+3:30) Tehran' },
  { value: '+4', label: '(+4) Dubai/Baku' },
  { value: '+4:30', label: '(+4:30) Kabul' },
  { value: '+5', label: '(+5) Karachi/Tashkent' },
  { value: '+5:30', label: '(+5:30) Mumbai/Colombo' },
  { value: '+5:45', label: '(+5:45) Kathmandu' },
  { value: '+6', label: '(+6) Dhaka/Almaty' },
  { value: '+6:30', label: '(+6:30) Yangon' },
  { value: '+7', label: '(+7) Bangkok/Jakarta/Hanoi' },
  { value: '+8', label: '(+8) Beijing/Singapore/Perth' },
  { value: '+8:45', label: '(+8:45) Eucla' },
  { value: '+9', label: '(+9) Tokyo/Seoul' },
  { value: '+9:30', label: '(+9:30) Adelaide/Darwin' },
  { value: '+10', label: '(+10) Sydney/Vladivostok' },
  { value: '+10:30', label: '(+10:30) Lord Howe Island' },
  { value: '+11', label: '(+11) Solomon Islands/Magadan' },
  { value: '+12', label: '(+12) Auckland/Fiji' },
  { value: '+12:45', label: '(+12:45) Chatham Islands' },
  { value: '+13', label: '(+13) Tonga/Phoenix Islands' },
  { value: '+14', label: '(+14) Kiribati/Line Islands' },
];
