import re
from pprint import pprint
import json

with open('empty.smw', 'r') as myfile:
    data=myfile.read()

#print(data)
prog = re.compile(r'\[(.*?)\]', re.DOTALL)
result = prog.findall(data)

data = []

for t in result:
	obj1 = t.split('\n')
	obj = {}
	for o in obj1:
		if o == '':
			continue
		else:
			obj2 = o.split('=')
			obj[obj2[0]] = obj2[1]

	#pprint(obj)
	data.append(obj)

#print(json.dumps(data, indent=4, sort_keys=True))


		


last = ""

signals = []

# FSgntr 	SIMPL Windows Information		{'ObjTp': 'FSgntr', 'MinSMWVrs': '0', 'RelVrs': '4.03.20', 'Sgntr': 'SimplWindow', 'MinTIOVrs': '0', 'IntStrVrs': '2', 'SavedBy': 'SMW4.03.20'}
# Hd		File Information				{'DlrNm': 'DEAMER_NAME', 'SmVr': '989', 'TpN3': '3', 'PgmNm': 'PROGRAMMER', 'TpN1': '1', 'ZeroOnIoOk': '0', 'TpN4': '4', 'TpN5': '5', 'DvcDbVr': '74.05.002.00', 'TpN2': '2', 'CmVr': 'COMPILER_VERSION', 'DvVr': '989', 'S0Nd': '1', 'JpNo': 'SYSTEM_NUMBER', 'PrNm': 'empty.smw', 'FltTmp': '1', 'CltNm': 'SYSTEM_NAME', 'PIT': 'PROGRAM_ID', 'OpVr': 'FIRMWARE_VERSION', 'DbVr': '56.00.002.00', 'SLNd': '3', 'EnType': '0', 'APg': '1', 'S1Nd': '2', 'Cmn1': 'COMMENT', 'SGMethod': '1', 'ObjTp': 'Hd', 'FpCS': '0'}
# Dv		Hardware Information
# Cm 		Com port Configuration 			{'hHs': '(None)', 'Ptl': '(RS232)', 'DvH': '628', 'SBt': '1', 'H': '1', 'BRt': '9600', 'Tis': '1', 'Pty': 'N', 'sHs': '(None)', 'ObjTp': 'Cm', 'DBt': '8'}
#											x hHs: Hardware Handshake
#											x Ptl: Communication Standard
#											x DvH: ?
#											x SBt: Stop Bits
#											H:   ?
#											x BRt: Baud Rate
#											Tis: ?
#											x Pty: Parity
#											x sHs: Software Handshake
#											x ObjTp: Object Type
#											x DBt: Data Bits
# Db		Crestron devices config
# Ui		Pointers to VTP files
# Cs 		???
# FP		File partition ???
# Bk		Bookmarks - 1 Bk entity per program file
# Bw		Symbols that are open and attributes about where they are placed on the screen
# Et		Ethernet IP Config
# VTP		Touch panel smart path
# EtU		???
# Sm 		Symbol Configuration
# CED		Smart Objects
# Sg		Signal Configuration 			{'SgTp': '2', 'H': '73', 'Nm': 'mic_vol_init_a', 'ObjTp': 'Sg'}

class Signal:
	"""docstring for Signal"""
	def __init__(self, signalStr):
		self.typ = signalStr.get('SgTp', '1') # analog:2 , serial:4
		self.id = signalStr.get('H')
		self.name = signalStr.get('Nm')

	def __str__(self):
		return "Signal: " + str(self.name) + " Id: " + str(self.id) + " Typ: " + str(self.typ)

class ComPort:
	def __init__(self, objStr):
		self.DvH = objStr.get('DvH')
		self.ComStandard = objStr.get('Ptl')
		self.BaudRate = objStr.get('BRt')
		self.DataBits = objStr.get('DBt')
		self.StopBits = objStr.get('SBt')
		self.Parity = objStr.get('Pty')
		self.HwHandshake = objStr.get('hHs')
		self.SwHandshake = objStr.get('sHs')
		self.H = objStr.get('H')
		self.Tis = objStr.get('Tis')

	def __str__(self):
		return '%s Com Port %s Baud, %s Data Bits, %s Stop Bits, %s Parity, %s HW Handshake, %s SW Handshake' % (self.ComStandard, self.BaudRate, self.DataBits, self.StopBits, self.Parity, self.HwHandshake, self.SwHandshake)

class SIMPLWindowsInfo:
	def __init__(self, infoStr):
		#{'ObjTp': 'FSgntr', 'MinSMWVrs': '0', 'RelVrs': '4.03.20', 'Sgntr': 'SimplWindow', 'MinTIOVrs': '0', 'IntStrVrs': '2', 'SavedBy': 'SMW4.03.20'}
		self.minSWVersion = infoStr.get('MinSMWVrs')
		self.ReleaseVersion = infoStr.get('RelVrs')
		self.Sgntr = infoStr.get('Sgntr')
		self.MinTIOVrs = infoStr.get('MinTIOVrs')
		self.IntStrVrs = infoStr.get('IntStrVrs')
		self.savedBy = infoStr.get('SavedBy')

	def __str__(self):
		return "SIMPL Windows Programm. Last saved SW Version %s" % (self.savedBy)

class FileInfo:
	def __init__(self, fileObj):
		#{'DlrNm': 'DEAMER_NAME', 'SmVr': '989', 'TpN3': '3', 'PgmNm': 'PROGRAMMER', 'TpN1': '1', 'ZeroOnIoOk': '0', 'TpN4': '4', 'TpN5': '5', 'DvcDbVr': '74.05.002.00', 
		#'TpN2': '2', 'CmVr': 'COMPILER_VERSION', 'DvVr': '989', 'S0Nd': '1', 'JpNo': 'SYSTEM_NUMBER', 'PrNm': 'empty.smw', 'FltTmp': '1', 'CltNm': 'SYSTEM_NAME', 
		#'PIT': 'PROGRAM_ID', 'OpVr': 'FIRMWARE_VERSION', 'DbVr': '56.00.002.00', 'SLNd': '3', 'EnType': '0', 'APg': '1', 'S1Nd': '2', 'Cmn1': 'COMMENT', 'SGMethod': '1', 
		#'ObjTp': 'Hd', 'FpCS': '0'}
		self.DealerName = fileObj.get('DlrNm')
		self.ProgrammerName = fileObj.get('PgmNm')
		self.DeviceDBVersion = fileObj.get('DvcDbVr')
		self.SystemNumber = fileObj.get('JpNo')
		self.FileName = fileObj.get('PrNm')
		self.SystemName = fileObj.get('CltNm')
		self.ProgramId = fileObj.get('PIT')
		self.DBVr = fileObj.get('DbVr')
		self.Comment = ''
		for i in range(1,100):
			self.Comment += fileObj.get('Cmn' + str(i), '')


class Program:
	ComPorts = []
	Signals = []
	def __init__(self):
		pass

	def __str__(self):
		retStr = """Programm: %s
Created at %s, by %s
Consists of HARDWARE
Last saved with SIMPL Windows Version %s
uses %d Com Ports
uses %d Signals
Comment:
%s""" % (self.FileInfo.SystemName, self.FileInfo.DealerName, self.FileInfo.ProgrammerName, self.SIMPLWindowsInfo.savedBy, len(self.ComPorts), len(self.Signals), self.FileInfo.Comment)
		return retStr

	def addComPort(self, ComPortObj):
		self.ComPorts.append(ComPortObj)
	def addSignal(self, SignalObj):
		self.Signals.append(SignalObj)
	def setSIMPLWindowsInfo(self, SWInfoObj):
		self.SIMPLWindowsInfo = SWInfoObj
	def setFileInfo(self, FileInfoObj):
		self.FileInfo = FileInfoObj

pr = Program()

for d in data:
	if 'ObjTp' not in d:
		continue
	if d['ObjTp'] == 'FSgntr':
		swinfo = SIMPLWindowsInfo(d)
		pr.setSIMPLWindowsInfo(swinfo)
	if d['ObjTp'] == 'Hd':
		fi = FileInfo(d)
		pr.setFileInfo(fi)
	#if d['ObjTp'] == 'Dv':
	#	print(d)
	if d['ObjTp'] == 'Cm':
		cp = ComPort(d)
		pr.addComPort(cp)
		print(cp)
	#if d['ObjTp'] == 'Db':
	#	print(d)
	#if d['ObjTp'] == 'FP':
	#	print(d)
	#if d['ObjTp'] == 'Bk':
	#	print(d)
	if d['ObjTp'] == 'Sm':
		#{'Nm': 'AND', 'I1': '4', 'H': '25', 'I3': '9', 'I2': '8', 'mI': '3', 'PrH': '4', 'CF': '2', 'ObjVer': '1', 'tO': '1', 'ObjTp': 'Sm', 'mO': '1', 'n1I': '3', 'SmC': '1', 'n1O': '1', 'O1': '10'}
		#I1 4
		#I2 8
		#I3 9
		#O1 10
		i=1
		while d.get('I' + str(i)) is not None:
			print(d.get('I' + str(i)))
			i += 1
		print(d)
	if d['ObjTp'] == 'Sg':
		s = Signal(d)
		pr.addSignal(s)

	if last != d['ObjTp']:
		print(d['ObjTp'])
		last = d['ObjTp']

print(pr)
for s in pr.Signals:
	print(s)

#Signal: test1 Id: 4 Typ: 1
#Signal: serial_signal Id: 5 Typ: 4
#Signal: analog_signal Id: 6 Typ: 2
#Signal: digital_signal Id: 7 Typ: 1
#Signal: test2 Id: 8 Typ: 1
#Signal: test3 Id: 9 Typ: 1
#Signal: test4 Id: 10 Typ: 1