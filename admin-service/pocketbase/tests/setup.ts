import * as h3 from 'h3'
import { vi } from 'vitest'

vi.stubGlobal('defineEventHandler', h3.defineEventHandler)
vi.stubGlobal('createError', h3.createError)
vi.stubGlobal('readBody', h3.readBody)
vi.stubGlobal('getRouterParam', h3.getRouterParam)
vi.stubGlobal('getQuery', h3.getQuery)
vi.stubGlobal('setHeader', h3.setHeader)
vi.stubGlobal('setResponseHeader', h3.setResponseHeader)
vi.stubGlobal('setResponseStatus', h3.setResponseStatus)
vi.stubGlobal('send', h3.send)
vi.stubGlobal('sendStream', h3.sendStream)
vi.stubGlobal('setCookie', h3.setCookie)
vi.stubGlobal('deleteCookie', h3.deleteCookie)
