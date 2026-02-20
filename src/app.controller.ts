import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('salary/calculate')
  calculateSalary(@Body() body: any) {
    return this.appService.calculateSalary(body);
  }
}
